/**
 * Notification Event Entity
 * Event log for notification delivery tracking
 */

export class NotificationEvent {
  event_id: string;
  notification_id: string;

  // Event details
  event_type: NotificationEventType;
  event_data?: any;

  // Provider details
  provider_event_id?: string;
  provider_timestamp?: Date;

  // Metadata
  occurred_at: Date;
}

export enum NotificationEventType {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  UNSUBSCRIBED = 'unsubscribed',
}
