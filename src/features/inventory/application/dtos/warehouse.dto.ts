/**
 * Warehouse DTOs
 */

import { IsString, IsOptional, IsNumber, IsBoolean, IsObject, IsEnum, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WarehouseAddressDto {
  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsString()
  country: string = 'India';
}

export class WarehouseContactDto {
  @IsOptional()
  @IsString()
  person?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateWarehouseDto {
  @IsString()
  businessId: string;

  @IsString()
  tenantId: string;

  @IsString()
  warehouseName: string;

  @IsString()
  warehouseCode: string;

  @IsOptional()
  @IsString()
  warehouseType?: string = 'warehouse';

  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseAddressDto)
  address?: WarehouseAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseContactDto)
  contact?: WarehouseContactDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number = 5;

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  warehouseName?: string;

  @IsOptional()
  @IsString()
  warehouseType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseAddressDto)
  address?: WarehouseAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WarehouseContactDto)
  contact?: WarehouseContactDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class WarehouseQueryDto {
  @IsString()
  businessId: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  warehouseType?: string;
}
