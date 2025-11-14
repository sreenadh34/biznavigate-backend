/**
 * Payment Entity
 * Domain model for Razorpay payment transactions
 */
export class Payment {
  payment_id: string;
  business_id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string;

  // Razorpay identifiers
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;

  // Payment details
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string; // card, netbanking, wallet, upi, etc.

  // Webhook tracking
  webhook_received_at?: Date;
  webhook_processed_at?: Date;
  webhook_attempts: number;

  // Refund tracking
  refund_amount: number;
  refunded_at?: Date;
  refund_reason?: string;

  // Payment timeline
  authorized_at?: Date;
  captured_at?: Date;
  failed_at?: Date;
  failure_reason?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Payment Status Enum
 * created: Order created in Razorpay
 * authorized: Payment authorized by customer (2-step payment)
 * captured: Payment successfully captured (money received)
 * failed: Payment failed
 * refunded: Full refund issued
 * partial_refund: Partial refund issued
 */
export enum PaymentStatus {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
}

/**
 * Payment Method Enum
 */
export enum PaymentMethod {
  CARD = 'card',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
  UPI = 'upi',
  EMI = 'emi',
  COD = 'cod',
}
