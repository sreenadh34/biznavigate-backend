/**
 * Notification Message Entity
 * Represents a single notification sent via any channel
 */

export class NotificationMessage {
  notification_id: string;
  business_id: string;
  tenant_id: string;

  // Recipient information
  customer_id?: string;
  user_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_name?: string;

  // Template & channel
  template_id?: string;
  template_key?: string;
  channel: NotificationChannel;

  // Content (final rendered content)
  subject?: string;
  body?: string;
  html_body?: string;

  // Context data (variables used for template rendering)
  context_data?: Record<string, any>;

  // Related entities
  related_entity_type?: string;
  related_entity_id?: string;

  // Delivery tracking
  status: NotificationStatus;
  priority: number;

  // Provider details
  provider?: string;
  provider_message_id?: string;
  provider_response?: any;

  // Timing
  scheduled_at?: Date;
  queued_at?: Date;
  sent_at?: Date;
  delivered_at?: Date;
  failed_at?: Date;

  // Retry logic
  retry_count: number;
  max_retries: number;
  last_retry_at?: Date;

  // Error tracking
  error_message?: string;
  error_code?: string;

  // Metadata
  created_at: Date;
  updated_at: Date;
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  CANCELLED = 'cancelled',
}

export enum NotificationPriority {
  URGENT = 1,
  HIGH = 2,
  NORMAL = 5,
  LOW = 8,
  BATCH = 10,
}
