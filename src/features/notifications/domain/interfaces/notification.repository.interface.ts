import {
  NotificationMessage,
  NotificationTemplate,
  NotificationPreference,
  NotificationEvent,
} from '../entities';

export interface INotificationRepository {
  // Notification Messages
  createMessage(message: Partial<NotificationMessage>): Promise<NotificationMessage>;
  findMessageById(id: string): Promise<NotificationMessage | null>;
  findMessagesByStatus(status: string): Promise<NotificationMessage[]>;
  findPendingMessages(limit?: number): Promise<NotificationMessage[]>;
  updateMessageStatus(
    id: string,
    status: string,
    metadata?: Partial<NotificationMessage>,
  ): Promise<NotificationMessage>;
  incrementRetryCount(id: string): Promise<NotificationMessage>;

  // Templates
  createTemplate(template: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  findTemplateById(id: string): Promise<NotificationTemplate | null>;
  findTemplateByKey(
    businessId: string | null,
    templateKey: string,
  ): Promise<NotificationTemplate | null>;
  findActiveTemplates(businessId?: string): Promise<NotificationTemplate[]>;
  updateTemplate(
    id: string,
    data: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // Preferences
  createPreference(preference: Partial<NotificationPreference>): Promise<NotificationPreference>;
  findPreferenceByCustomer(
    customerId: string,
    businessId?: string,
  ): Promise<NotificationPreference | null>;
  findPreferenceByUser(
    userId: string,
    businessId?: string,
  ): Promise<NotificationPreference | null>;
  updatePreference(
    id: string,
    data: Partial<NotificationPreference>,
  ): Promise<NotificationPreference>;

  // Events
  createEvent(event: Partial<NotificationEvent>): Promise<NotificationEvent>;
  findEventsByNotificationId(notificationId: string): Promise<NotificationEvent[]>;
}
