/**
 * Notification Template Entity
 * Reusable templates for multi-channel notifications
 */

import { NotificationChannel } from './notification-message.entity';

export class NotificationTemplate {
  template_id: string;
  business_id?: string;
  tenant_id?: string;

  // Template identification
  template_key: string; // e.g., 'order_confirmation', 'payment_receipt'
  template_name: string;
  description?: string;

  // Channel-specific content
  email_subject?: string;
  email_body?: string;
  email_html?: string;
  sms_body?: string;
  whatsapp_body?: string;
  push_title?: string;
  push_body?: string;

  // Template variables (JSON array of variable names)
  variables: string[]; // e.g., ["customer_name", "order_id", "amount"]

  // Channel enablement
  enabled_channels: NotificationChannel[];

  // Status
  is_active: boolean;
  is_system: boolean; // System templates cannot be deleted

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export enum TemplateKey {
  ORDER_CONFIRMATION = 'order_confirmation',
  PAYMENT_RECEIPT = 'payment_receipt',
  PAYMENT_FAILED = 'payment_failed',
  ORDER_SHIPPED = 'order_shipped',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELLED = 'order_cancelled',
  OTP_VERIFICATION = 'otp_verification',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
  LOW_STOCK_ALERT = 'low_stock_alert',
  ABANDONED_CART = 'abandoned_cart',
}
