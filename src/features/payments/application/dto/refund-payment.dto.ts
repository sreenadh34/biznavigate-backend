import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * DTO for creating a refund
 * Supports both full and partial refunds
 */
export class CreateRefundDto {
  @IsNotEmpty()
  @IsUUID()
  payment_id: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number; // If not provided, full refund

  @IsOptional()
  @IsString()
  reason?: string; // Reason for refund (customer request, order cancelled, etc.)

  @IsOptional()
  notes?: Record<string, any>; // Additional metadata
}

/**
 * DTO for refund response from Razorpay
 */
export interface RazorpayRefundResponse {
  id: string; // Refund ID (rfnd_xxxxx)
  entity: string; // "refund"
  amount: number; // Refund amount in paise
  currency: string;
  payment_id: string; // Original payment ID
  notes?: Record<string, any>;
  receipt?: string;
  status: string; // pending, processed, failed
  speed_requested: string; // normal, optimum
  speed_processed: string;
  created_at: number; // Unix timestamp
}
