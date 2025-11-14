import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, IsDateString, IsNotEmpty } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';
import { OrderStatus, PaymentStatus, PaymentMethod } from '../../domain/entities/order.entity';

/**
 * DTO for updating an order
 */
export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @IsEnum(PaymentMethod)
  @IsOptional()
  payment_method?: PaymentMethod;

  @IsString()
  @IsOptional()
  payment_reference?: string;

  @IsString()
  @IsOptional()
  tracking_number?: string;

  @IsString()
  @IsOptional()
  admin_notes?: string;
}

/**
 * DTO for updating order status
 */
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @IsString()
  @IsOptional()
  notes?: string; // Reason for status change
}

/**
 * DTO for confirming payment
 */
export class ConfirmPaymentDto {
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  payment_method: PaymentMethod;

  @IsString()
  @IsOptional()
  payment_reference?: string; // UPI transaction ID, etc.

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * DTO for updating shipping info
 */
export class UpdateShippingDto {
  @IsString()
  @IsNotEmpty()
  tracking_number: string;

  @IsString()
  @IsOptional()
  carrier?: string; // Shipping carrier name (e.g., FedEx, DHL)

  @IsString()
  @IsOptional()
  notes?: string;
}
