import { IsOptional, IsUUID, IsInt, Min, Max, IsBoolean, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryReviewsDto {
  // Filters
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_verified?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_published?: boolean;

  // Date range
  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  // Pagination
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  // Sorting
  @IsOptional()
  @IsIn(['created_at', 'rating', 'helpful_count'])
  sort_by?: 'created_at' | 'rating' | 'helpful_count';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
