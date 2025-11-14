import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Razorpay webhook payload
 * This is what Razorpay sends to our webhook endpoint
 */
export class PaymentWebhookDto {
  @IsNotEmpty()
  @IsString()
  event: string; // e.g., "payment.captured"

  @IsNotEmpty()
  @IsObject()
  payload: {
    payment: {
      entity: RazorpayPaymentEntity;
    };
  };

  @IsOptional()
  @IsString()
  account_id?: string;

  @IsOptional()
  @IsString()
  created_at?: number;
}

/**
 * Razorpay Payment Entity
 * Structure of payment object in webhook
 */
export interface RazorpayPaymentEntity {
  id: string; // Razorpay payment ID (pay_xxxxx)
  entity: string; // "payment"
  amount: number; // Amount in paise (₹100 = 10000 paise)
  currency: string;
  status: string; // authorized, captured, failed, etc.
  order_id: string; // Razorpay order ID (order_xxxxx)
  method: string; // card, netbanking, wallet, upi
  captured: boolean;
  email?: string;
  contact?: string;
  fee?: number;
  tax?: number;
  error_code?: string;
  error_description?: string;
  created_at: number; // Unix timestamp
}

/**
 * DTO for verifying payment signature
 * Used after customer completes payment on frontend
 */
export class VerifyPaymentSignatureDto {
  @IsNotEmpty()
  @IsString()
  razorpay_order_id: string;

  @IsNotEmpty()
  @IsString()
  razorpay_payment_id: string;

  @IsNotEmpty()
  @IsString()
  razorpay_signature: string;
}
