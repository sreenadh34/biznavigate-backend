import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { INotificationRepository } from '../domain/interfaces/notification.repository.interface';
import {
  NotificationMessage,
  NotificationTemplate,
  NotificationPreference,
  NotificationEvent,
} from '../domain/entities';

/**
 * Notification Repository Implementation with Prisma
 */
@Injectable()
export class NotificationRepositoryPrisma implements INotificationRepository {
  private readonly logger = new Logger(NotificationRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========================================
  // NOTIFICATION MESSAGES
  // ========================================

  async createMessage(message: Partial<NotificationMessage>): Promise<NotificationMessage> {
    const created = await this.prisma.notification_messages.create({
      data: {
        business_id: message.business_id,
        tenant_id: message.tenant_id,
        customer_id: message.customer_id,
        user_id: message.user_id,
        recipient_email: message.recipient_email,
        recipient_phone: message.recipient_phone,
        recipient_name: message.recipient_name,
        template_id: message.template_id,
        template_key: message.template_key,
        channel: message.channel,
        subject: message.subject,
        body: message.body,
        html_body: message.html_body,
        context_data: message.context_data as any,
        related_entity_type: message.related_entity_type,
        related_entity_id: message.related_entity_id,
        status: message.status || 'pending',
        priority: message.priority || 5,
        scheduled_at: message.scheduled_at,
        max_retries: message.max_retries || 3,
      } as any,
    });

    return this.toDomainMessage(created);
  }

  async findMessageById(id: string): Promise<NotificationMessage | null> {
    const message = await this.prisma.notification_messages.findUnique({
      where: { notification_id: id },
    });

    return message ? this.toDomainMessage(message) : null;
  }

  async findMessagesByStatus(status: string): Promise<NotificationMessage[]> {
    const messages = await this.prisma.notification_messages.findMany({
      where: { status },
      orderBy: { created_at: 'desc' },
    });

    return messages.map((msg) => this.toDomainMessage(msg));
  }

  async findPendingMessages(limit: number = 100): Promise<NotificationMessage[]> {
    const messages = await this.prisma.notification_messages.findMany({
      where: {
        status: { in: ['pending', 'queued'] },
        OR: [{ scheduled_at: null }, { scheduled_at: { lte: new Date() } }],
      },
      orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
      take: limit,
    });

    return messages.map((msg) => this.toDomainMessage(msg));
  }

  async updateMessageStatus(
    id: string,
    status: string,
    metadata?: Partial<NotificationMessage>,
  ): Promise<NotificationMessage> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'queued') {
      updateData.queued_at = new Date();
    } else if (status === 'sent') {
      updateData.sent_at = new Date();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date();
    } else if (status === 'failed') {
      updateData.failed_at = new Date();
    }

    if (metadata) {
      Object.assign(updateData, {
        provider: metadata.provider,
        provider_message_id: metadata.provider_message_id,
        provider_response: metadata.provider_response,
        error_message: metadata.error_message,
        error_code: metadata.error_code,
      });
    }

    const updated = await this.prisma.notification_messages.update({
      where: { notification_id: id },
      data: updateData,
    });

    return this.toDomainMessage(updated);
  }

  async incrementRetryCount(id: string): Promise<NotificationMessage> {
    const updated = await this.prisma.notification_messages.update({
      where: { notification_id: id },
      data: {
        retry_count: { increment: 1 },
        last_retry_at: new Date(),
      },
    });

    return this.toDomainMessage(updated);
  }

  // ========================================
  // TEMPLATES
  // ========================================

  async createTemplate(template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const created = await this.prisma.notification_templates.create({
      data: {
        business_id: template.business_id,
        tenant_id: template.tenant_id,
        template_key: template.template_key,
        template_name: template.template_name,
        description: template.description,
        email_subject: template.email_subject,
        email_body: template.email_body,
        email_html: template.email_html,
        sms_body: template.sms_body,
        whatsapp_body: template.whatsapp_body,
        push_title: template.push_title,
        push_body: template.push_body,
        variables: template.variables as any,
        enabled_channels: template.enabled_channels as any,
        is_active: template.is_active !== undefined ? template.is_active : true,
        is_system: template.is_system || false,
        created_by: template.created_by,
      } as any,
    });

    return this.toDomainTemplate(created);
  }

  async findTemplateById(id: string): Promise<NotificationTemplate | null> {
    const template = await this.prisma.notification_templates.findUnique({
      where: { template_id: id },
    });

    return template ? this.toDomainTemplate(template) : null;
  }

  async findTemplateByKey(
    businessId: string | null,
    templateKey: string,
  ): Promise<NotificationTemplate | null> {
    // First try to find business-specific template
    if (businessId) {
      const businessTemplate = await this.prisma.notification_templates.findFirst({
        where: {
          business_id: businessId,
          template_key: templateKey,
          is_active: true,
        },
      });

      if (businessTemplate) {
        return this.toDomainTemplate(businessTemplate);
      }
    }

    // Fall back to system template
    const systemTemplate = await this.prisma.notification_templates.findFirst({
      where: {
        business_id: null,
        template_key: templateKey,
        is_active: true,
        is_system: true,
      },
    });

    return systemTemplate ? this.toDomainTemplate(systemTemplate) : null;
  }

  async findActiveTemplates(businessId?: string): Promise<NotificationTemplate[]> {
    const templates = await this.prisma.notification_templates.findMany({
      where: {
        is_active: true,
        ...(businessId ? { OR: [{ business_id: businessId }, { business_id: null, is_system: true }] } : {}),
      },
      orderBy: { created_at: 'desc' },
    });

    return templates.map((t) => this.toDomainTemplate(t));
  }

  async updateTemplate(
    id: string,
    data: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate> {
    const updated = await this.prisma.notification_templates.update({
      where: { template_id: id },
      data: {
        template_name: data.template_name,
        description: data.description,
        email_subject: data.email_subject,
        email_body: data.email_body,
        email_html: data.email_html,
        sms_body: data.sms_body,
        whatsapp_body: data.whatsapp_body,
        push_title: data.push_title,
        push_body: data.push_body,
        variables: data.variables as any,
        enabled_channels: data.enabled_channels as any,
        is_active: data.is_active,
        updated_at: new Date(),
      } as any,
    });

    return this.toDomainTemplate(updated);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.prisma.notification_templates.delete({
      where: { template_id: id },
    });
  }

  // ========================================
  // PREFERENCES
  // ========================================

  async createPreference(
    preference: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const created = await this.prisma.notification_preferences.create({
      data: {
        customer_id: preference.customer_id,
        user_id: preference.user_id,
        business_id: preference.business_id,
        email_enabled: preference.email_enabled !== undefined ? preference.email_enabled : true,
        sms_enabled: preference.sms_enabled !== undefined ? preference.sms_enabled : true,
        whatsapp_enabled:
          preference.whatsapp_enabled !== undefined ? preference.whatsapp_enabled : true,
        push_enabled: preference.push_enabled !== undefined ? preference.push_enabled : true,
        preferences: preference.preferences as any,
        quiet_hours: preference.quiet_hours as any,
        channel_preferences: preference.channel_preferences as any,
      } as any,
    });

    return this.toDomainPreference(created);
  }

  async findPreferenceByCustomer(
    customerId: string,
    businessId?: string,
  ): Promise<NotificationPreference | null> {
    const preference = await this.prisma.notification_preferences.findFirst({
      where: {
        customer_id: customerId,
        ...(businessId ? { business_id: businessId } : {}),
      },
    });

    return preference ? this.toDomainPreference(preference) : null;
  }

  async findPreferenceByUser(
    userId: string,
    businessId?: string,
  ): Promise<NotificationPreference | null> {
    const preference = await this.prisma.notification_preferences.findFirst({
      where: {
        user_id: userId,
        ...(businessId ? { business_id: businessId } : {}),
      },
    });

    return preference ? this.toDomainPreference(preference) : null;
  }

  async updatePreference(
    id: string,
    data: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const updated = await this.prisma.notification_preferences.update({
      where: { preference_id: id },
      data: {
        email_enabled: data.email_enabled,
        sms_enabled: data.sms_enabled,
        whatsapp_enabled: data.whatsapp_enabled,
        push_enabled: data.push_enabled,
        preferences: data.preferences as any,
        quiet_hours: data.quiet_hours as any,
        channel_preferences: data.channel_preferences as any,
        updated_at: new Date(),
      } as any,
    });

    return this.toDomainPreference(updated);
  }

  // ========================================
  // EVENTS
  // ========================================

  async createEvent(event: Partial<NotificationEvent>): Promise<NotificationEvent> {
    const created = await this.prisma.notification_events.create({
      data: {
        notification_id: event.notification_id,
        event_type: event.event_type,
        event_data: event.event_data as any,
        provider_event_id: event.provider_event_id,
        provider_timestamp: event.provider_timestamp,
      } as any,
    });

    return this.toDomainEvent(created);
  }

  async findEventsByNotificationId(notificationId: string): Promise<NotificationEvent[]> {
    const events = await this.prisma.notification_events.findMany({
      where: { notification_id: notificationId },
      orderBy: { occurred_at: 'desc' },
    });

    return events.map((e) => this.toDomainEvent(e));
  }

  // ========================================
  // MAPPERS
  // ========================================

  private toDomainMessage(prismaMessage: any): NotificationMessage {
    return {
      ...prismaMessage,
      context_data: prismaMessage.context_data || {},
      provider_response: prismaMessage.provider_response || null,
      retry_count: prismaMessage.retry_count || 0,
      max_retries: prismaMessage.max_retries || 3,
    } as NotificationMessage;
  }

  private toDomainTemplate(prismaTemplate: any): NotificationTemplate {
    return {
      ...prismaTemplate,
      variables: Array.isArray(prismaTemplate.variables) ? prismaTemplate.variables : [],
      enabled_channels: Array.isArray(prismaTemplate.enabled_channels)
        ? prismaTemplate.enabled_channels
        : [],
    } as NotificationTemplate;
  }

  private toDomainPreference(prismaPreference: any): NotificationPreference {
    return {
      ...prismaPreference,
      preferences: prismaPreference.preferences || {},
      quiet_hours: prismaPreference.quiet_hours || { enabled: false, start: '22:00', end: '08:00' },
      channel_preferences: prismaPreference.channel_preferences || {},
    } as NotificationPreference;
  }

  private toDomainEvent(prismaEvent: any): NotificationEvent {
    return {
      ...prismaEvent,
      event_data: prismaEvent.event_data || null,
    } as NotificationEvent;
  }
}
