/**
 * Warehouse Service
 * Manages warehouse operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Warehouse } from '../../domain';
import { CreateWarehouseDto, UpdateWarehouseDto, WarehouseQueryDto } from '../dtos';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  async createWarehouse(dto: CreateWarehouseDto): Promise<Warehouse> {
    return await this.inventoryService.createWarehouse({
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      warehouseName: dto.warehouseName,
      warehouseCode: dto.warehouseCode,
      warehouseType: dto.warehouseType,
      address: dto.address,
      contact: dto.contact,
      totalCapacity: dto.totalCapacity,
      isDefault: dto.isDefault,
      isActive: dto.isActive,
      priority: dto.priority,
      operatingHours: dto.operatingHours,
      metadata: dto.metadata,
    });
  }

  async getWarehouseById(warehouseId: string): Promise<Warehouse> {
    return await this.inventoryService.getWarehouseById(warehouseId);
  }

  async getWarehouses(query: WarehouseQueryDto): Promise<Warehouse[]> {
    return await this.inventoryService.getWarehousesByBusiness(query.businessId, {
      isActive: query.isActive,
      isDefault: query.isDefault,
      warehouseType: query.warehouseType,
    });
  }

  async updateWarehouse(warehouseId: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    return await this.inventoryService.updateWarehouse(warehouseId, dto);
  }

  async deleteWarehouse(warehouseId: string): Promise<void> {
    await this.inventoryService.deleteWarehouse(warehouseId);
  }

  async activateWarehouse(warehouseId: string): Promise<Warehouse> {
    return await this.inventoryService.updateWarehouse(warehouseId, { isActive: true });
  }

  async deactivateWarehouse(warehouseId: string): Promise<Warehouse> {
    return await this.inventoryService.updateWarehouse(warehouseId, { isActive: false });
  }

  async setDefaultWarehouse(warehouseId: string, businessId: string): Promise<Warehouse> {
    // First, unset any existing default
    const warehouses = await this.inventoryService.getWarehousesByBusiness(businessId, {
      isDefault: true,
    });

    for (const warehouse of warehouses) {
      if (warehouse.warehouseId !== warehouseId) {
        await this.inventoryService.updateWarehouse(warehouse.warehouseId, { isDefault: false });
      }
    }

    // Set new default
    return await this.inventoryService.updateWarehouse(warehouseId, { isDefault: true });
  }
}
