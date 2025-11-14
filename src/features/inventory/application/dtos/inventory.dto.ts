/**
 * Inventory Operation DTOs
 */

import { IsString, IsNumber, IsOptional, IsEnum, Min, IsObject, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum StockAdjustmentReason {
  PHYSICAL_COUNT = 'physical_count',
  DAMAGE = 'damage',
  THEFT = 'theft',
  FOUND = 'found',
  CORRECTION = 'correction',
  EXPIRED = 'expired',
  OTHER = 'other',
}

export class AdjustStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  quantityChange: number;

  @IsEnum(StockAdjustmentReason)
  reason: StockAdjustmentReason;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class AddStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class DeductStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class ReserveStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class ReleaseStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class TransferStockDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  fromWarehouseId: string;

  @IsString()
  toWarehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class UpdateReorderSettingsDto {
  @IsString()
  businessId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Min(0)
  reorderPoint: number;

  @IsNumber()
  @Min(1)
  reorderQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStockLevel?: number;
}

export class UpdateStockLocationDto {
  @IsString()
  businessId: string;

  @IsString()
  warehouseId: string;

  @IsString()
  variantId: string;

  @IsOptional()
  @IsString()
  binLocation?: string;

  @IsOptional()
  @IsString()
  aisle?: string;

  @IsOptional()
  @IsString()
  shelf?: string;
}

export class GetInventoryLevelDto {
  @IsString()
  businessId: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  lowStockOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  outOfStockOnly?: boolean;
}

export class StockMovementQueryDto {
  @IsString()
  businessId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  movementType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 100;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number = 0;
}
