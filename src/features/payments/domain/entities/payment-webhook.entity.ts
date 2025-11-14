/**
 * Payment Webhook Entity
 * Stores audit trail of all webhook events from Razorpay
 */
export class PaymentWebhook {
  webhook_id: string;
  payment_id?: string;

  // Webhook details
  event_type: string; // payment.authorized, payment.captured, payment.failed, etc.
  razorpay_event_id: string; // Unique event ID from Razorpay (for idempotency)
  payload: any; // Full webhook payload (JSON)
  signature?: string; // Webhook signature for verification

  // Processing status
  status: WebhookStatus;
  retry_count: number;
  error_message?: string;

  // Timestamps
  received_at: Date;
  processed_at?: Date;
}

/**
 * Webhook Status Enum
 */
export enum WebhookStatus {
  PENDING = 'pending', // Received but not yet processed
  PROCESSED = 'processed', // Successfully processed
  FAILED = 'failed', // Processing failed (will retry)
  DUPLICATE = 'duplicate', // Duplicate event (already processed)
  INVALID_SIGNATURE = 'invalid_signature', // Failed signature verification
}

/**
 * Webhook Event Types from Razorpay
 */
export enum WebhookEventType {
  ORDER_PAID = 'order.paid',
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_CREATED = 'refund.created',
  REFUND_PROCESSED = 'refund.processed',
  REFUND_FAILED = 'refund.failed',
}
