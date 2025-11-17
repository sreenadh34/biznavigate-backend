import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for querying/filtering products
 * Supports pagination, filtering, and sorting
 */
export class ProductQueryDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search in name, description, SKU

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['physical', 'course', 'event', 'service'])
  product_type?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  in_stock?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  min_price?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  max_price?: number;

  // Pagination
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500) // Increased from 100 to support larger data exports
  limit?: number = 20;

  // Cursor-based pagination for very large datasets (optional)
  @IsOptional()
  @IsString()
  cursor?: string; // Product ID to start from

  // Include total count (can be disabled for performance on very large datasets)
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_count?: boolean = true;

  // Sorting
  @IsOptional()
  @IsIn(['name', 'price', 'created_at', 'stock_quantity'])
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
