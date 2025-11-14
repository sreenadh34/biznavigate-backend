/**
 * Warehouse Controller
 * REST API endpoints for warehouse management
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
  Logger,
} from '@nestjs/common';
import { WarehouseService } from '../services/warehouse.service';
import { CreateWarehouseDto, UpdateWarehouseDto, WarehouseQueryDto } from '../dtos';

@Controller('warehouses')
export class WarehouseController {
  private readonly logger = new Logger(WarehouseController.name);

  constructor(private readonly warehouseService: WarehouseService) {}

  /**
   * Create warehouse
   * POST /warehouses
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWarehouse(@Body() dto: CreateWarehouseDto) {
    this.logger.log(`Creating warehouse: ${dto.warehouseName}`);

    const warehouse = await this.warehouseService.createWarehouse(dto);

    return {
      success: true,
      message: 'Warehouse created successfully',
      data: warehouse.toObject(),
    };
  }

  /**
   * Get all warehouses
   * GET /warehouses
   */
  @Get()
  async getWarehouses(@Query() query: WarehouseQueryDto) {
    this.logger.log(`Fetching warehouses for business ${query.businessId}`);

    const warehouses = await this.warehouseService.getWarehouses(query);

    return {
      success: true,
      data: warehouses.map(w => w.toObject()),
      count: warehouses.length,
    };
  }

  /**
   * Get warehouse by ID
   * GET /warehouses/:id
   */
  @Get(':id')
  async getWarehouseById(@Param('id') warehouseId: string) {
    this.logger.log(`Fetching warehouse ${warehouseId}`);

    const warehouse = await this.warehouseService.getWarehouseById(warehouseId);

    return {
      success: true,
      data: warehouse.toObject(),
    };
  }

  /**
   * Update warehouse
   * PUT /warehouses/:id
   */
  @Put(':id')
  async updateWarehouse(
    @Param('id') warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    this.logger.log(`Updating warehouse ${warehouseId}`);

    const warehouse = await this.warehouseService.updateWarehouse(warehouseId, dto);

    return {
      success: true,
      message: 'Warehouse updated successfully',
      data: warehouse.toObject(),
    };
  }

  /**
   * Delete warehouse
   * DELETE /warehouses/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWarehouse(@Param('id') warehouseId: string) {
    this.logger.log(`Deleting warehouse ${warehouseId}`);

    await this.warehouseService.deleteWarehouse(warehouseId);

    return {
      success: true,
      message: 'Warehouse deleted successfully',
    };
  }

  /**
   * Activate warehouse
   * POST /warehouses/:id/activate
   */
  @Post(':id/activate')
  async activateWarehouse(@Param('id') warehouseId: string) {
    this.logger.log(`Activating warehouse ${warehouseId}`);

    const warehouse = await this.warehouseService.activateWarehouse(warehouseId);

    return {
      success: true,
      message: 'Warehouse activated successfully',
      data: warehouse.toObject(),
    };
  }

  /**
   * Deactivate warehouse
   * POST /warehouses/:id/deactivate
   */
  @Post(':id/deactivate')
  async deactivateWarehouse(@Param('id') warehouseId: string) {
    this.logger.log(`Deactivating warehouse ${warehouseId}`);

    const warehouse = await this.warehouseService.deactivateWarehouse(warehouseId);

    return {
      success: true,
      message: 'Warehouse deactivated successfully',
      data: warehouse.toObject(),
    };
  }

  /**
   * Set as default warehouse
   * POST /warehouses/:id/set-default
   */
  @Post(':id/set-default')
  async setDefaultWarehouse(
    @Param('id') warehouseId: string,
    @Query('businessId') businessId: string,
  ) {
    this.logger.log(`Setting warehouse ${warehouseId} as default for business ${businessId}`);

    const warehouse = await this.warehouseService.setDefaultWarehouse(warehouseId, businessId);

    return {
      success: true,
      message: 'Default warehouse set successfully',
      data: warehouse.toObject(),
    };
  }
}
