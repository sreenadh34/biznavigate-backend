import { IsOptional, IsUUID, IsEnum, IsNumber, IsDateString, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus, OrderSource } from '../../domain/entities/order.entity';

/**
 * DTO for querying orders with filters
 */
export class OrderQueryDto {
  // Filters
  @IsUUID()
  @IsOptional()
  business_id?: string;

  @IsUUID()
  @IsOptional()
  customer_id?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @IsEnum(OrderSource)
  @IsOptional()
  source?: OrderSource;

  // Date range filters
  @IsDateString()
  @IsOptional()
  from_date?: string; // Orders created after this date

  @IsDateString()
  @IsOptional()
  to_date?: string; // Orders created before this date

  // Amount filters
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  min_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  max_amount?: number;

  // Search
  @IsOptional()
  search?: string; // Search by order number, customer name, phone

  // Pagination
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  // Sorting
  @IsIn(['created_at', 'total_amount', 'order_number', 'updated_at'])
  @IsOptional()
  sort_by?: string = 'created_at';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}
