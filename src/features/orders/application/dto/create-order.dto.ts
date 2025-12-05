import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderSource, PaymentMethod } from '../../domain/entities/order.entity';

/**
 * DTO for creating an order item
 */
export class CreateOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  product_id: string;

  @IsUUID()
  @IsOptional()
  variant_id?: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number; // Discount on this specific item
}

/**
 * DTO for creating an order
 */
export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  business_id: string;

  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @IsUUID()
  @IsNotEmpty()
  customer_id: string;

  // Order Type
  @IsString()
  @IsOptional()
  order_type?: string; // e.g., 'product', 'course', 'service'

  // Order Items
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @IsNotEmpty()
  items: CreateOrderItemDto[];

  // Discounts and Fees
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shipping_fee?: number;

  // Shipping Address
  @IsString()
  @IsOptional()
  shipping_address?: string;

  @IsString()
  @IsOptional()
  shipping_city?: string;

  @IsString()
  @IsOptional()
  shipping_state?: string;

  @IsString()
  @IsOptional()
  shipping_pincode?: string;

  @IsString()
  @IsOptional()
  shipping_phone?: string;

  // Payment
  @IsEnum(PaymentMethod)
  @IsOptional()
  payment_method?: PaymentMethod;

  // Metadata
  @IsString()
  @IsOptional()
  notes?: string; // Customer notes

  @IsString()
  @IsOptional()
  admin_notes?: string; // Internal notes

  @IsEnum(OrderSource)
  @IsOptional()
  source?: OrderSource;
}
