/**
 * Inventory Service
 * Business logic for inventory management operations
 * Handles concurrent operations safely with transactions
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryRepositoryPrisma } from '../../infrastructure/inventory.repository.prisma';
import { Warehouse, InventoryLevel, StockMovement, StockAlert, MovementType, AlertType, AlertSeverity } from '../../domain';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly repository: InventoryRepositoryPrisma,
  ) {}

  // ============================================
  // WAREHOUSE MANAGEMENT
  // ============================================

  async createWarehouse(data: {
    businessId: string;
    tenantId: string;
    warehouseName: string;
    warehouseCode: string;
    warehouseType?: string;
    address?: any;
    contact?: any;
    totalCapacity?: number;
    isDefault?: boolean;
    isActive?: boolean;
    priority?: number;
    operatingHours?: any;
    metadata?: any;
  }): Promise<Warehouse> {
    const warehouse = new Warehouse(
      uuidv4(),
      data.businessId,
      data.tenantId,
      data.warehouseName,
      data.warehouseCode,
      data.warehouseType || 'warehouse',
      data.address || { country: 'India' },
      data.contact || {},
      data.totalCapacity,
      0, // usedCapacity starts at 0
      data.isDefault || false,
      data.isActive !== false, // default true
      data.priority || 5,
      data.operatingHours || {},
      data.metadata || {},
    );

    const errors = warehouse.validate();
    if (errors.length > 0) {
      throw new BadRequestException(`Warehouse validation failed: ${errors.join(', ')}`);
    }

    return await this.repository.createWarehouse(warehouse);
  }

  async getWarehouseById(warehouseId: string): Promise<Warehouse> {
    const warehouse = await this.repository.findWarehouseById(warehouseId);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
    return warehouse;
  }

  async getWarehousesByBusiness(
    businessId: string,
    filters?: { isActive?: boolean; isDefault?: boolean; warehouseType?: string },
  ): Promise<Warehouse[]> {
    return await this.repository.findWarehousesByBusiness(businessId, filters);
  }

  async updateWarehouse(warehouseId: string, updates: any): Promise<Warehouse> {
    const existing = await this.getWarehouseById(warehouseId);
    existing.updateDetails(updates);

    const errors = existing.validate();
    if (errors.length > 0) {
      throw new BadRequestException(`Warehouse validation failed: ${errors.join(', ')}`);
    }

    return await this.repository.updateWarehouse(warehouseId, existing);
  }

  async deleteWarehouse(warehouseId: string): Promise<void> {
    await this.getWarehouseById(warehouseId); // Verify exists
    await this.repository.deleteWarehouse(warehouseId);
  }

  // ============================================
  // STOCK OPERATIONS (HIGH CONCURRENCY)
  // ============================================

  /**
   * Add stock (e.g., from purchase, production)
   * Uses transaction for atomicity
   */
  async addStock(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantity: number;
    unitCost?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel; movement: StockMovement }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      // Get or create inventory level
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      const quantityBefore = inventoryLevel.availableQuantity;

      // Update inventory level
      inventoryLevel.addStock(data.quantity, data.unitCost);

      const errors = inventoryLevel.validate();
      if (errors.length > 0) {
        throw new BadRequestException(`Inventory validation failed: ${errors.join(', ')}`);
      }

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Create stock movement (audit trail)
      const movement = StockMovement.createPurchase(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
        inventoryLevel.inventoryLevelId,
        data.quantity,
        quantityBefore,
        data.unitCost || 0,
        data.referenceId,
        data.createdBy,
      );

      if (data.notes) {
        movement.notes = data.notes;
      }

      const createdMovement = await this.repository.createStockMovement(movement);

      // Check if we need to resolve any low stock alerts
      await this.checkAndResolveAlerts(inventoryLevel);

      return { inventoryLevel: updated, movement: createdMovement };
    });
  }

  /**
   * Deduct stock (e.g., for sale, write-off)
   * Uses transaction for atomicity
   */
  async deductStock(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel; movement: StockMovement }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      const quantityBefore = inventoryLevel.availableQuantity;

      // Check availability
      if (inventoryLevel.availableQuantity < data.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${inventoryLevel.availableQuantity}, Requested: ${data.quantity}`,
        );
      }

      // Update inventory level
      inventoryLevel.deductStock(data.quantity);

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Create stock movement
      const movement = new StockMovement(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
        inventoryLevel.inventoryLevelId,
        MovementType.SALE,
        -data.quantity,
        quantityBefore,
        quantityBefore - data.quantity,
        new Date(),
        data.referenceType,
        data.referenceId,
        undefined,
        undefined,
        undefined,
        undefined,
        data.notes || 'Stock deducted',
        undefined,
        data.createdBy,
      );

      const createdMovement = await this.repository.createStockMovement(movement);

      // Check if we need to create alerts
      await this.checkAndCreateAlerts(inventoryLevel);

      return { inventoryLevel: updated, movement: createdMovement };
    });
  }

  /**
   * Adjust stock (for physical count, corrections)
   * Uses transaction for atomicity
   */
  async adjustStock(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantityChange: number;
    reason: string;
    notes?: string;
    unitCost?: number;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel; movement: StockMovement }> {
    if (data.quantityChange === 0) {
      throw new BadRequestException('Quantity change cannot be zero');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      const quantityBefore = inventoryLevel.availableQuantity;
      const newQuantity = quantityBefore + data.quantityChange;

      if (newQuantity < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock. Current: ${quantityBefore}, Change: ${data.quantityChange}`,
        );
      }

      // Adjust stock
      inventoryLevel.adjustStock(newQuantity, data.reason);

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Create stock movement
      const movement = StockMovement.createAdjustment(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
        inventoryLevel.inventoryLevelId,
        data.quantityChange,
        quantityBefore,
        data.reason,
        data.createdBy,
      );

      if (data.notes) {
        movement.notes = data.notes;
      }

      const createdMovement = await this.repository.createStockMovement(movement);

      // Check alerts
      if (data.quantityChange < 0) {
        await this.checkAndCreateAlerts(inventoryLevel);
      } else {
        await this.checkAndResolveAlerts(inventoryLevel);
      }

      return { inventoryLevel: updated, movement: createdMovement };
    });
  }

  /**
   * Reserve stock (for pending orders)
   * Uses transaction for atomicity
   */
  async reserveStock(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantity: number;
    orderId: string;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      // Check availability
      if (inventoryLevel.availableQuantity < data.quantity) {
        throw new BadRequestException(
          `Insufficient stock to reserve. Available: ${inventoryLevel.availableQuantity}, Requested: ${data.quantity}`,
        );
      }

      // Reserve stock
      inventoryLevel.reserveStock(data.quantity);

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Check if reservation caused low stock
      await this.checkAndCreateAlerts(inventoryLevel);

      return { inventoryLevel: updated };
    });
  }

  /**
   * Release reserved stock (order cancelled)
   * Uses transaction for atomicity
   */
  async releaseReservedStock(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantity: number;
    orderId: string;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      // Release reserved stock
      inventoryLevel.releaseReservedStock(data.quantity);

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Check if release resolved alerts
      await this.checkAndResolveAlerts(inventoryLevel);

      return { inventoryLevel: updated };
    });
  }

  /**
   * Confirm sale (convert reserved to sold)
   * Uses transaction for atomicity
   */
  async confirmSale(data: {
    businessId: string;
    tenantId: string;
    warehouseId: string;
    variantId: string;
    quantity: number;
    orderId: string;
    createdBy?: string;
  }): Promise<{ inventoryLevel: InventoryLevel; movement: StockMovement }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    return await this.repository.executeStockTransaction(async (tx) => {
      const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
      );

      const quantityBefore = inventoryLevel.availableQuantity + inventoryLevel.reservedQuantity;

      // Confirm sale
      inventoryLevel.confirmSale(data.quantity);

      const updated = await this.repository.updateInventoryLevelAtomic(
        inventoryLevel.inventoryLevelId,
        inventoryLevel,
      );

      // Create stock movement
      const movement = StockMovement.createSale(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.warehouseId,
        data.variantId,
        inventoryLevel.inventoryLevelId,
        data.quantity,
        quantityBefore,
        data.orderId,
        data.createdBy,
      );

      const createdMovement = await this.repository.createStockMovement(movement);

      return { inventoryLevel: updated, movement: createdMovement };
    });
  }

  /**
   * Transfer stock between warehouses
   * Uses transaction for atomicity across both warehouses
   */
  async transferStock(data: {
    businessId: string;
    tenantId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    variantId: string;
    quantity: number;
    notes?: string;
    createdBy?: string;
  }): Promise<{
    fromInventoryLevel: InventoryLevel;
    toInventoryLevel: InventoryLevel;
    movements: StockMovement[];
  }> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestException('Cannot transfer to the same warehouse');
    }

    const transferId = uuidv4();

    return await this.repository.executeStockTransaction(async (tx) => {
      // Get inventory levels
      const fromLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.fromWarehouseId,
        data.variantId,
      );

      const toLevel = await this.repository.getOrCreateInventoryLevel(
        data.businessId,
        data.tenantId,
        data.toWarehouseId,
        data.variantId,
      );

      // Check availability
      if (fromLevel.availableQuantity < data.quantity) {
        throw new BadRequestException(
          `Insufficient stock in source warehouse. Available: ${fromLevel.availableQuantity}, Requested: ${data.quantity}`,
        );
      }

      const fromQuantityBefore = fromLevel.availableQuantity;
      const toQuantityBefore = toLevel.availableQuantity;

      // Deduct from source
      fromLevel.deductStock(data.quantity);
      const updatedFrom = await this.repository.updateInventoryLevelAtomic(
        fromLevel.inventoryLevelId,
        fromLevel,
      );

      // Add to destination
      toLevel.addStock(data.quantity, fromLevel.averageCost);
      const updatedTo = await this.repository.updateInventoryLevelAtomic(
        toLevel.inventoryLevelId,
        toLevel,
      );

      // Create stock movements for both warehouses
      const outMovement = StockMovement.createTransferOut(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.fromWarehouseId,
        data.toWarehouseId,
        data.variantId,
        fromLevel.inventoryLevelId,
        data.quantity,
        fromQuantityBefore,
        transferId,
        data.createdBy,
      );

      const inMovement = StockMovement.createTransferIn(
        uuidv4(),
        data.businessId,
        data.tenantId,
        data.toWarehouseId,
        data.fromWarehouseId,
        data.variantId,
        toLevel.inventoryLevelId,
        data.quantity,
        toQuantityBefore,
        transferId,
        data.createdBy,
      );

      const movements = await Promise.all([
        this.repository.createStockMovement(outMovement),
        this.repository.createStockMovement(inMovement),
      ]);

      // Check alerts
      await this.checkAndCreateAlerts(updatedFrom);
      await this.checkAndResolveAlerts(updatedTo);

      return {
        fromInventoryLevel: updatedFrom,
        toInventoryLevel: updatedTo,
        movements,
      };
    });
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  async getInventoryLevels(filters: {
    businessId: string;
    tenantId?: string;
    warehouseId?: string;
    variantId?: string;
    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
  }): Promise<InventoryLevel[]> {
    return await this.repository.findInventoryLevels(filters);
  }

  async getStockMovements(filters: {
    businessId: string;
    warehouseId?: string;
    variantId?: string;
    movementType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<StockMovement[]> {
    return await this.repository.findStockMovements(filters);
  }

  async updateReorderSettings(data: {
    businessId: string;
    warehouseId: string;
    variantId: string;
    reorderPoint: number;
    reorderQuantity: number;
    maxStockLevel?: number;
  }): Promise<InventoryLevel> {
    const inventoryLevel = await this.repository.getOrCreateInventoryLevel(
      data.businessId,
      '', // tenantId not needed for lookup
      data.warehouseId,
      data.variantId,
    );

    inventoryLevel.updateReorderSettings(
      data.reorderPoint,
      data.reorderQuantity,
      data.maxStockLevel,
    );

    return await this.repository.updateInventoryLevelAtomic(
      inventoryLevel.inventoryLevelId,
      inventoryLevel,
    );
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  async getActiveAlerts(businessId: string, warehouseId?: string): Promise<StockAlert[]> {
    return await this.repository.findActiveAlerts(businessId, warehouseId);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<StockAlert> {
    const alerts = await this.repository.findActiveAlerts('', ''); // Get by ID
    // Implementation would fetch specific alert and acknowledge it
    throw new Error('Not implemented - needs alert fetch by ID');
  }

  private async checkAndCreateAlerts(inventoryLevel: InventoryLevel): Promise<void> {
    try {
      if (inventoryLevel.isOutOfStock) {
        const alert = StockAlert.createOutOfStockAlert(
          uuidv4(),
          inventoryLevel.businessId,
          inventoryLevel.tenantId,
          inventoryLevel.warehouseId,
          inventoryLevel.variantId,
          inventoryLevel.inventoryLevelId,
          inventoryLevel.reorderPoint,
          inventoryLevel.getRecommendedReorderQuantity(),
        );
        await this.repository.createStockAlert(alert);
      } else if (inventoryLevel.isLowStock) {
        const alert = StockAlert.createLowStockAlert(
          uuidv4(),
          inventoryLevel.businessId,
          inventoryLevel.tenantId,
          inventoryLevel.warehouseId,
          inventoryLevel.variantId,
          inventoryLevel.inventoryLevelId,
          inventoryLevel.availableQuantity,
          inventoryLevel.reorderPoint,
          inventoryLevel.getRecommendedReorderQuantity(),
        );
        await this.repository.createStockAlert(alert);
      }
    } catch (error) {
      this.logger.warn(`Failed to create alert: ${error.message}`);
    }
  }

  private async checkAndResolveAlerts(inventoryLevel: InventoryLevel): Promise<void> {
    // Implementation would resolve alerts if stock is back above reorder point
    // This is simplified - full implementation would query and update alerts
  }
}
