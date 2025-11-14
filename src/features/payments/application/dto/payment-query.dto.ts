import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../domain/entities/payment.entity';

/**
 * DTO for querying payments
 * Supports filtering, pagination, and sorting
 */
export class PaymentQueryDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  method?: string; // card, upi, netbanking, wallet

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  // Date range filters
  @IsOptional()
  @IsDateString()
  from_date?: string; // ISO date string

  @IsOptional()
  @IsDateString()
  to_date?: string; // ISO date string

  // Amount range filters
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_amount?: number;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Sorting
  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at'; // created_at, amount, status

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}
