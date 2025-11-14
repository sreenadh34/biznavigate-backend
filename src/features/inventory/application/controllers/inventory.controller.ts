/**
 * Inventory Controller
 * REST API endpoints for inventory management
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';
import {
  AddStockDto,
  DeductStockDto,
  AdjustStockDto,
  ReserveStockDto,
  ReleaseStockDto,
  TransferStockDto,
  UpdateReorderSettingsDto,
  UpdateStockLocationDto,
  GetInventoryLevelDto,
  StockMovementQueryDto,
} from '../dtos';

@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly inventoryService: InventoryService) {}

  // ============================================
  // STOCK OPERATIONS
  // ============================================

  /**
   * Add stock (purchase, production, etc.)
   * POST /inventory/stock/add
   */
  @Post('stock/add')
  @HttpCode(HttpStatus.CREATED)
  async addStock(@Body() dto: AddStockDto) {
    this.logger.log(`Adding ${dto.quantity} units to warehouse ${dto.warehouseId}, variant ${dto.variantId}`);

    const result = await this.inventoryService.addStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      notes: dto.notes,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully added ${dto.quantity} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
        movement: result.movement.toObject(),
      },
    };
  }

  /**
   * Deduct stock (sale, write-off, etc.)
   * POST /inventory/stock/deduct
   */
  @Post('stock/deduct')
  @HttpCode(HttpStatus.OK)
  async deductStock(@Body() dto: DeductStockDto) {
    this.logger.log(`Deducting ${dto.quantity} units from warehouse ${dto.warehouseId}, variant ${dto.variantId}`);

    const result = await this.inventoryService.deductStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      notes: dto.notes,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully deducted ${dto.quantity} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
        movement: result.movement.toObject(),
      },
    };
  }

  /**
   * Adjust stock (physical count, corrections)
   * POST /inventory/stock/adjust
   */
  @Post('stock/adjust')
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Body() dto: AdjustStockDto) {
    this.logger.log(`Adjusting stock by ${dto.quantityChange} units for warehouse ${dto.warehouseId}, variant ${dto.variantId}`);

    const result = await this.inventoryService.adjustStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantityChange: dto.quantityChange,
      reason: dto.reason,
      notes: dto.notes,
      unitCost: dto.unitCost,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully adjusted stock by ${dto.quantityChange} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
        movement: result.movement.toObject(),
      },
    };
  }

  /**
   * Reserve stock (for orders)
   * POST /inventory/stock/reserve
   */
  @Post('stock/reserve')
  @HttpCode(HttpStatus.OK)
  async reserveStock(@Body() dto: ReserveStockDto) {
    this.logger.log(`Reserving ${dto.quantity} units for order ${dto.orderId}`);

    const result = await this.inventoryService.reserveStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      orderId: dto.orderId,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully reserved ${dto.quantity} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
      },
    };
  }

  /**
   * Release reserved stock (order cancelled)
   * POST /inventory/stock/release
   */
  @Post('stock/release')
  @HttpCode(HttpStatus.OK)
  async releaseStock(@Body() dto: ReleaseStockDto) {
    this.logger.log(`Releasing ${dto.quantity} reserved units for order ${dto.orderId}`);

    const result = await this.inventoryService.releaseReservedStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      orderId: dto.orderId,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully released ${dto.quantity} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
      },
    };
  }

  /**
   * Confirm sale (convert reserved to sold)
   * POST /inventory/stock/confirm-sale
   */
  @Post('stock/confirm-sale')
  @HttpCode(HttpStatus.OK)
  async confirmSale(@Body() dto: ReleaseStockDto) {
    this.logger.log(`Confirming sale of ${dto.quantity} units for order ${dto.orderId}`);

    const result = await this.inventoryService.confirmSale({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      orderId: dto.orderId,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully confirmed sale of ${dto.quantity} units`,
      data: {
        inventoryLevel: result.inventoryLevel.toObject(),
        movement: result.movement.toObject(),
      },
    };
  }

  /**
   * Transfer stock between warehouses
   * POST /inventory/stock/transfer
   */
  @Post('stock/transfer')
  @HttpCode(HttpStatus.OK)
  async transferStock(@Body() dto: TransferStockDto) {
    this.logger.log(`Transferring ${dto.quantity} units from warehouse ${dto.fromWarehouseId} to ${dto.toWarehouseId}`);

    const result = await this.inventoryService.transferStock({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      variantId: dto.variantId,
      quantity: dto.quantity,
      notes: dto.notes,
      createdBy: dto.createdBy,
    });

    return {
      success: true,
      message: `Successfully transferred ${dto.quantity} units between warehouses`,
      data: {
        fromInventoryLevel: result.fromInventoryLevel.toObject(),
        toInventoryLevel: result.toInventoryLevel.toObject(),
        movements: result.movements.map(m => m.toObject()),
      },
    };
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get inventory levels
   * GET /inventory/levels
   */
  @Get('levels')
  async getInventoryLevels(@Query() query: GetInventoryLevelDto) {
    this.logger.log(`Fetching inventory levels for business ${query.businessId}`);

    const levels = await this.inventoryService.getInventoryLevels({
      businessId: query.businessId,
      tenantId: query.tenantId,
      warehouseId: query.warehouseId,
      variantId: query.variantId,
      lowStockOnly: query.lowStockOnly,
      outOfStockOnly: query.outOfStockOnly,
    });

    return {
      success: true,
      data: levels.map(l => l.toObject()),
      count: levels.length,
    };
  }

  /**
   * Get stock movements (audit trail)
   * GET /inventory/movements
   */
  @Get('movements')
  async getStockMovements(@Query() query: StockMovementQueryDto) {
    this.logger.log(`Fetching stock movements for business ${query.businessId}`);

    const movements = await this.inventoryService.getStockMovements({
      businessId: query.businessId,
      warehouseId: query.warehouseId,
      variantId: query.variantId,
      movementType: query.movementType,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      success: true,
      data: movements.map(m => m.toObject()),
      count: movements.length,
      pagination: {
        limit: query.limit || 100,
        offset: query.offset || 0,
      },
    };
  }

  /**
   * Get low stock alerts
   * GET /inventory/alerts/low-stock
   */
  @Get('alerts/low-stock')
  async getLowStockAlerts(
    @Query('businessId') businessId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    this.logger.log(`Fetching low stock alerts for business ${businessId}`);

    const alerts = await this.inventoryService.getActiveAlerts(businessId, warehouseId);

    return {
      success: true,
      data: alerts.map(a => a.toObject()),
      count: alerts.length,
    };
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Update reorder settings
   * PUT /inventory/reorder-settings
   */
  @Put('reorder-settings')
  async updateReorderSettings(@Body() dto: UpdateReorderSettingsDto) {
    this.logger.log(`Updating reorder settings for variant ${dto.variantId} in warehouse ${dto.warehouseId}`);

    const inventoryLevel = await this.inventoryService.updateReorderSettings({
      businessId: dto.businessId,
      warehouseId: dto.warehouseId,
      variantId: dto.variantId,
      reorderPoint: dto.reorderPoint,
      reorderQuantity: dto.reorderQuantity,
      maxStockLevel: dto.maxStockLevel,
    });

    return {
      success: true,
      message: 'Reorder settings updated successfully',
      data: inventoryLevel.toObject(),
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get inventory summary
   * GET /inventory/summary
   */
  @Get('summary')
  async getInventorySummary(
    @Query('businessId') businessId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    this.logger.log(`Fetching inventory summary for business ${businessId}`);

    const levels = await this.inventoryService.getInventoryLevels({
      businessId,
      warehouseId,
    });

    const totalProducts = levels.length;
    const totalStockValue = levels.reduce((sum, l) => sum + l.totalValue, 0);
    const lowStockCount = levels.filter(l => l.isLowStock).length;
    const outOfStockCount = levels.filter(l => l.isOutOfStock).length;
    const totalAvailableUnits = levels.reduce((sum, l) => sum + l.availableQuantity, 0);
    const totalReservedUnits = levels.reduce((sum, l) => sum + l.reservedQuantity, 0);

    return {
      success: true,
      data: {
        totalProducts,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        totalAvailableUnits,
        totalReservedUnits,
        healthScore: Math.round(((totalProducts - outOfStockCount - lowStockCount) / totalProducts) * 100) || 0,
      },
    };
  }
}
