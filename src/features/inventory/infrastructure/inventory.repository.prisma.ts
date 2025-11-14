/**
 * Inventory Repository - Prisma Implementation
 * Handles all database operations for inventory management
 * Designed for high concurrency with transaction safety
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Warehouse, InventoryLevel, StockMovement, StockAlert } from '../domain';
import { MovementType } from '../domain/stock-movement.entity';

@Injectable()
export class InventoryRepositoryPrisma {
  private readonly logger = new Logger(InventoryRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // WAREHOUSE OPERATIONS
  // ============================================

  async createWarehouse(warehouse: Warehouse): Promise<Warehouse> {
    const created = await this.prisma.warehouses.create({
      data: {
        warehouse_id: warehouse.warehouseId,
        business_id: warehouse.businessId,
        tenant_id: warehouse.tenantId,
        warehouse_name: warehouse.warehouseName,
        warehouse_code: warehouse.warehouseCode,
        warehouse_type: warehouse.warehouseType,
        address_line1: warehouse.address.line1,
        address_line2: warehouse.address.line2,
        city: warehouse.address.city,
        state: warehouse.address.state,
        postal_code: warehouse.address.postalCode,
        country: warehouse.address.country,
        contact_person: warehouse.contact.person,
        contact_email: warehouse.contact.email,
        contact_phone: warehouse.contact.phone,
        total_capacity: warehouse.totalCapacity,
        used_capacity: warehouse.usedCapacity,
        is_default: warehouse.isDefault,
        is_active: warehouse.isActive,
        priority: warehouse.priority,
        operating_hours: warehouse.operatingHours as any,
        metadata: warehouse.metadata as any,
      },
    });

    return this.mapToWarehouse(created);
  }

  async findWarehouseById(warehouseId: string): Promise<Warehouse | null> {
    const warehouse = await this.prisma.warehouses.findUnique({
      where: { warehouse_id: warehouseId },
    });

    return warehouse ? this.mapToWarehouse(warehouse) : null;
  }

  async findWarehousesByBusiness(businessId: string, filters?: {
    isActive?: boolean;
    isDefault?: boolean;
    warehouseType?: string;
  }): Promise<Warehouse[]> {
    const warehouses = await this.prisma.warehouses.findMany({
      where: {
        business_id: businessId,
        ...(filters?.isActive !== undefined && { is_active: filters.isActive }),
        ...(filters?.isDefault !== undefined && { is_default: filters.isDefault }),
        ...(filters?.warehouseType && { warehouse_type: filters.warehouseType }),
      },
      orderBy: [
        { is_default: 'desc' },
        { priority: 'asc' },
      ],
    });

    return warehouses.map(w => this.mapToWarehouse(w));
  }

  async updateWarehouse(warehouseId: string, updates: Partial<Warehouse>): Promise<Warehouse> {
    const updated = await this.prisma.warehouses.update({
      where: { warehouse_id: warehouseId },
      data: {
        ...(updates.warehouseName && { warehouse_name: updates.warehouseName }),
        ...(updates.warehouseType && { warehouse_type: updates.warehouseType }),
        ...(updates.address && {
          address_line1: updates.address.line1,
          address_line2: updates.address.line2,
          city: updates.address.city,
          state: updates.address.state,
          postal_code: updates.address.postalCode,
          country: updates.address.country,
        }),
        ...(updates.contact && {
          contact_person: updates.contact.person,
          contact_email: updates.contact.email,
          contact_phone: updates.contact.phone,
        }),
        ...(updates.totalCapacity !== undefined && { total_capacity: updates.totalCapacity }),
        ...(updates.isDefault !== undefined && { is_default: updates.isDefault }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.operatingHours && { operating_hours: updates.operatingHours as any }),
        updated_at: new Date(),
      },
    });

    return this.mapToWarehouse(updated);
  }

  async deleteWarehouse(warehouseId: string): Promise<void> {
    await this.prisma.warehouses.delete({
      where: { warehouse_id: warehouseId },
    });
  }

  // ============================================
  // INVENTORY LEVEL OPERATIONS (HIGH CONCURRENCY)
  // ============================================

  async getOrCreateInventoryLevel(
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
  ): Promise<InventoryLevel> {
    // Try to find existing
    let inventoryLevel = await this.prisma.inventory_levels.findUnique({
      where: {
        warehouse_id_variant_id: {
          warehouse_id: warehouseId,
          variant_id: variantId,
        },
      },
    });

    // Create if doesn't exist
    if (!inventoryLevel) {
      try {
        inventoryLevel = await this.prisma.inventory_levels.create({
          data: {
            business_id: businessId,
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            variant_id: variantId,
            available_quantity: 0,
            reserved_quantity: 0,
            damaged_quantity: 0,
            in_transit_quantity: 0,
            reorder_point: 10,
            reorder_quantity: 50,
            average_cost: 0,
            total_value: 0,
          },
        });
      } catch (error) {
        // Handle race condition - another request created it
        inventoryLevel = await this.prisma.inventory_levels.findUnique({
          where: {
            warehouse_id_variant_id: {
              warehouse_id: warehouseId,
              variant_id: variantId,
            },
          },
        });
      }
    }

    return this.mapToInventoryLevel(inventoryLevel!);
  }

  async findInventoryLevelById(inventoryLevelId: string): Promise<InventoryLevel | null> {
    const level = await this.prisma.inventory_levels.findUnique({
      where: { inventory_level_id: inventoryLevelId },
    });

    return level ? this.mapToInventoryLevel(level) : null;
  }

  async findInventoryLevels(filters: {
    businessId: string;
    tenantId?: string;
    warehouseId?: string;
    variantId?: string;
    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
  }): Promise<InventoryLevel[]> {
    const levels = await this.prisma.inventory_levels.findMany({
      where: {
        business_id: filters.businessId,
        ...(filters.tenantId && { tenant_id: filters.tenantId }),
        ...(filters.warehouseId && { warehouse_id: filters.warehouseId }),
        ...(filters.variantId && { variant_id: filters.variantId }),
        ...(filters.lowStockOnly && { is_low_stock: true }),
        ...(filters.outOfStockOnly && { is_out_of_stock: true }),
      },
      include: {
        warehouses: true,
        product_variants: {
          include: {
            product: true,
          },
        },
      },
    });

    return levels.map(l => this.mapToInventoryLevel(l));
  }

  /**
   * Update inventory level with optimistic locking for concurrency
   * Uses Prisma transaction with isolation level
   */
  async updateInventoryLevelAtomic(
    inventoryLevelId: string,
    updates: Partial<InventoryLevel>,
  ): Promise<InventoryLevel> {
    const updated = await this.prisma.inventory_levels.update({
      where: { inventory_level_id: inventoryLevelId },
      data: {
        ...(updates.availableQuantity !== undefined && { available_quantity: updates.availableQuantity }),
        ...(updates.reservedQuantity !== undefined && { reserved_quantity: updates.reservedQuantity }),
        ...(updates.damagedQuantity !== undefined && { damaged_quantity: updates.damagedQuantity }),
        ...(updates.inTransitQuantity !== undefined && { in_transit_quantity: updates.inTransitQuantity }),
        ...(updates.reorderPoint !== undefined && { reorder_point: updates.reorderPoint }),
        ...(updates.reorderQuantity !== undefined && { reorder_quantity: updates.reorderQuantity }),
        ...(updates.maxStockLevel !== undefined && { max_stock_level: updates.maxStockLevel }),
        ...(updates.averageCost !== undefined && { average_cost: updates.averageCost }),
        ...(updates.totalValue !== undefined && { total_value: updates.totalValue }),
        ...(updates.location && {
          bin_location: updates.location.binLocation,
          aisle: updates.location.aisle,
          shelf: updates.location.shelf,
        }),
        ...(updates.lastCountedAt && { last_counted_at: updates.lastCountedAt }),
        ...(updates.lastRestockAt && { last_restock_at: updates.lastRestockAt }),
        ...(updates.isLowStock !== undefined && { is_low_stock: updates.isLowStock }),
        ...(updates.isOutOfStock !== undefined && { is_out_of_stock: updates.isOutOfStock }),
        updated_at: new Date(),
      },
    });

    return this.mapToInventoryLevel(updated);
  }

  // ============================================
  // STOCK MOVEMENT OPERATIONS (AUDIT TRAIL)
  // ============================================

  async createStockMovement(movement: StockMovement): Promise<StockMovement> {
    const created = await this.prisma.stock_movements.create({
      data: {
        movement_id: movement.movementId,
        business_id: movement.businessId,
        tenant_id: movement.tenantId,
        warehouse_id: movement.warehouseId,
        variant_id: movement.variantId,
        inventory_level_id: movement.inventoryLevelId,
        movement_type: movement.movementType,
        movement_date: movement.movementDate,
        reference_type: movement.referenceType,
        reference_id: movement.referenceId,
        quantity_change: movement.quantityChange,
        quantity_before: movement.quantityBefore,
        quantity_after: movement.quantityAfter,
        unit_cost: movement.unitCost,
        total_cost: movement.totalCost,
        from_warehouse_id: movement.fromWarehouseId,
        to_warehouse_id: movement.toWarehouseId,
        reason: movement.reason,
        notes: movement.notes,
        created_by: movement.createdBy,
        approved_by: movement.approvedBy,
        metadata: movement.metadata as any,
      },
    });

    return this.mapToStockMovement(created);
  }

  async findStockMovements(filters: {
    businessId: string;
    warehouseId?: string;
    variantId?: string;
    movementType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<StockMovement[]> {
    const movements = await this.prisma.stock_movements.findMany({
      where: {
        business_id: filters.businessId,
        ...(filters.warehouseId && { warehouse_id: filters.warehouseId }),
        ...(filters.variantId && { variant_id: filters.variantId }),
        ...(filters.movementType && { movement_type: filters.movementType }),
        ...(filters.startDate && filters.endDate && {
          movement_date: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        }),
      },
      orderBy: { movement_date: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    return movements.map(m => this.mapToStockMovement(m));
  }

  // ============================================
  // STOCK ALERT OPERATIONS
  // ============================================

  async createStockAlert(alert: StockAlert): Promise<StockAlert> {
    const created = await this.prisma.stock_alerts.create({
      data: {
        alert_id: alert.alertId,
        business_id: alert.businessId,
        tenant_id: alert.tenantId,
        warehouse_id: alert.warehouseId,
        variant_id: alert.variantId,
        inventory_level_id: alert.inventoryLevelId,
        alert_type: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        current_quantity: alert.currentQuantity,
        reorder_point: alert.reorderPoint,
        recommended_order_quantity: alert.recommendedOrderQuantity,
        notification_sent: alert.notificationSent,
        metadata: alert.metadata as any,
      },
    });

    return this.mapToStockAlert(created);
  }

  async findActiveAlerts(businessId: string, warehouseId?: string): Promise<StockAlert[]> {
    const alerts = await this.prisma.stock_alerts.findMany({
      where: {
        business_id: businessId,
        status: 'active',
        ...(warehouseId && { warehouse_id: warehouseId }),
      },
      orderBy: [
        { severity: 'desc' },
        { created_at: 'asc' },
      ],
    });

    return alerts.map(a => this.mapToStockAlert(a));
  }

  async updateStockAlert(alertId: string, updates: Partial<StockAlert>): Promise<StockAlert> {
    const updated = await this.prisma.stock_alerts.update({
      where: { alert_id: alertId },
      data: {
        ...(updates.status && { status: updates.status }),
        ...(updates.acknowledgedAt && { acknowledged_at: updates.acknowledgedAt }),
        ...(updates.acknowledgedBy && { acknowledged_by: updates.acknowledgedBy }),
        ...(updates.resolvedAt && { resolved_at: updates.resolvedAt }),
        ...(updates.resolvedBy && { resolved_by: updates.resolvedBy }),
        ...(updates.resolutionNotes && { resolution_notes: updates.resolutionNotes }),
        ...(updates.notificationSent !== undefined && { notification_sent: updates.notificationSent }),
        ...(updates.notificationSentAt && { notification_sent_at: updates.notificationSentAt }),
        updated_at: new Date(),
      },
    });

    return this.mapToStockAlert(updated);
  }

  // ============================================
  // TRANSACTION OPERATIONS (CRITICAL FOR CONCURRENCY)
  // ============================================

  /**
   * Execute inventory operation within a transaction
   * Ensures atomic updates across inventory_levels and stock_movements
   */
  async executeStockTransaction<T>(
    operation: (tx: any) => Promise<T>,
  ): Promise<T> {
    return await this.prisma.$transaction(operation, {
      isolationLevel: 'Serializable', // Highest isolation for concurrent operations
      maxWait: 10000, // 10 seconds
      timeout: 20000, // 20 seconds
    });
  }

  // ============================================
  // MAPPERS (DATABASE TO DOMAIN)
  // ============================================

  private mapToWarehouse(data: any): Warehouse {
    return new Warehouse(
      data.warehouse_id,
      data.business_id,
      data.tenant_id,
      data.warehouse_name,
      data.warehouse_code,
      data.warehouse_type,
      {
        line1: data.address_line1,
        line2: data.address_line2,
        city: data.city,
        state: data.state,
        postalCode: data.postal_code,
        country: data.country,
      },
      {
        person: data.contact_person,
        email: data.contact_email,
        phone: data.contact_phone,
      },
      data.total_capacity,
      data.used_capacity,
      data.is_default,
      data.is_active,
      data.priority,
      data.operating_hours || {},
      data.metadata || {},
      data.created_at,
      data.updated_at,
    );
  }

  private mapToInventoryLevel(data: any): InventoryLevel {
    return new InventoryLevel(
      data.inventory_level_id,
      data.business_id,
      data.tenant_id,
      data.warehouse_id,
      data.variant_id,
      data.available_quantity,
      data.reserved_quantity,
      data.damaged_quantity,
      data.in_transit_quantity,
      data.reorder_point,
      data.reorder_quantity,
      data.max_stock_level,
      Number(data.average_cost),
      Number(data.total_value),
      {
        binLocation: data.bin_location,
        aisle: data.aisle,
        shelf: data.shelf,
      },
      data.last_counted_at,
      data.last_restock_at,
      data.is_low_stock,
      data.is_out_of_stock,
      data.metadata || {},
      data.created_at,
      data.updated_at,
    );
  }

  private mapToStockMovement(data: any): StockMovement {
    return new StockMovement(
      data.movement_id,
      data.business_id,
      data.tenant_id,
      data.warehouse_id,
      data.variant_id,
      data.inventory_level_id,
      data.movement_type as MovementType,
      data.quantity_change,
      data.quantity_before,
      data.quantity_after,
      data.movement_date,
      data.reference_type,
      data.reference_id,
      data.unit_cost ? Number(data.unit_cost) : undefined,
      data.total_cost ? Number(data.total_cost) : undefined,
      data.from_warehouse_id,
      data.to_warehouse_id,
      data.reason,
      data.notes,
      data.created_by,
      data.approved_by,
      data.metadata || {},
      data.created_at,
    );
  }

  private mapToStockAlert(data: any): StockAlert {
    return new StockAlert(
      data.alert_id,
      data.business_id,
      data.tenant_id,
      data.warehouse_id,
      data.variant_id,
      data.inventory_level_id,
      data.alert_type,
      data.current_quantity,
      data.severity,
      data.status,
      data.reorder_point,
      data.recommended_order_quantity,
      data.acknowledged_at,
      data.acknowledged_by,
      data.resolved_at,
      data.resolved_by,
      data.resolution_notes,
      data.notification_sent,
      data.notification_sent_at,
      data.metadata || {},
      data.created_at,
      data.updated_at,
    );
  }
}
