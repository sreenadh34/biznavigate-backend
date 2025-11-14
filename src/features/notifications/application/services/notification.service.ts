import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationRepositoryPrisma } from '../../infrastructure/notification.repository.prisma';
import { EmailService } from '../../infrastructure/email.service';
import { SmsService } from '../../infrastructure/sms.service';
import { WhatsAppService } from '../../infrastructure/whatsapp.service';
import { TemplateEngineService } from '../../infrastructure/template-engine.service';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  NotificationEventType,
} from '../../domain/entities';
import {
  SendNotificationDto,
  SendMultiChannelNotificationDto,
  SendBulkNotificationDto,
} from '../dtos';

/**
 * Notification Service
 * Main orchestration layer for sending notifications across multiple channels
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepositoryPrisma,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly whatsappService: WhatsAppService,
    private readonly templateEngine: TemplateEngineService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  /**
   * Send a single notification
   * Can be immediate or queued based on priority
   */
  async send(dto: SendNotificationDto): Promise<any> {
    this.logger.log(
      `Sending ${dto.channel} notification to ${dto.recipient_email || dto.recipient_phone}`,
    );

    // Validate recipient based on channel
    this.validateRecipient(dto.channel, dto);

    // Get and render template if template_key provided
    let subject = dto.subject;
    let body = dto.body;
    let html_body = dto.html_body;

    if (dto.template_key) {
      const template = await this.repository.findTemplateByKey(dto.business_id, dto.template_key);
      if (!template) {
        throw new NotFoundException(`Template not found: ${dto.template_key}`);
      }

      // Check if channel is enabled for this template
      if (!template.enabled_channels.includes(dto.channel)) {
        throw new BadRequestException(
          `Channel ${dto.channel} not enabled for template ${dto.template_key}`,
        );
      }

      // Render template content
      const context = dto.context_data || {};
      switch (dto.channel) {
        case NotificationChannel.EMAIL:
          subject = template.email_subject
            ? this.templateEngine.render(template.email_subject, context)
            : subject;
          body = template.email_body
            ? this.templateEngine.render(template.email_body, context)
            : body;
          html_body = template.email_html
            ? this.templateEngine.render(template.email_html, context)
            : html_body;
          break;
        case NotificationChannel.SMS:
          body = template.sms_body
            ? this.templateEngine.render(template.sms_body, context)
            : body;
          break;
        case NotificationChannel.WHATSAPP:
          body = template.whatsapp_body
            ? this.templateEngine.render(template.whatsapp_body, context)
            : body;
          break;
        case NotificationChannel.PUSH:
          subject = template.push_title
            ? this.templateEngine.render(template.push_title, context)
            : subject;
          body = template.push_body
            ? this.templateEngine.render(template.push_body, context)
            : body;
          break;
      }
    }

    // Create notification record
    const notification = await this.repository.createMessage({
      business_id: dto.business_id,
      tenant_id: dto.tenant_id,
      customer_id: dto.customer_id,
      user_id: dto.user_id,
      recipient_email: dto.recipient_email,
      recipient_phone: dto.recipient_phone,
      recipient_name: dto.recipient_name,
      template_key: dto.template_key,
      channel: dto.channel,
      subject,
      body,
      html_body,
      context_data: dto.context_data,
      related_entity_type: dto.related_entity_type,
      related_entity_id: dto.related_entity_id,
      status: NotificationStatus.PENDING,
      priority: dto.priority || NotificationPriority.NORMAL,
      scheduled_at: dto.scheduled_at,
    });

    // Queue or send immediately based on priority
    if (dto.priority && dto.priority <= NotificationPriority.HIGH) {
      // High priority - send immediately
      await this.sendImmediately(notification.notification_id);
    } else {
      // Normal/Low priority - queue for async processing
      await this.queueNotification(notification.notification_id);
    }

    return {
      notification_id: notification.notification_id,
      status: notification.status,
      channel: notification.channel,
    };
  }

  /**
   * Send multi-channel notification (same message across multiple channels)
   */
  async sendMultiChannel(dto: SendMultiChannelNotificationDto): Promise<any> {
    this.logger.log(`Sending multi-channel notification via ${dto.channels.join(', ')}`);

    const results = [];

    for (const channel of dto.channels) {
      try {
        const result = await this.send({
          business_id: dto.business_id,
          tenant_id: dto.tenant_id,
          customer_id: dto.customer_id,
          user_id: dto.user_id,
          recipient_email: dto.recipient_email,
          recipient_phone: dto.recipient_phone,
          recipient_name: dto.recipient_name,
          template_key: dto.template_key,
          channel,
          context_data: dto.context_data,
          related_entity_type: dto.related_entity_type,
          related_entity_id: dto.related_entity_id,
          priority: dto.priority,
        });

        results.push({ channel, success: true, notification_id: result.notification_id });
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification: ${error.message}`);
        results.push({ channel, success: false, error: error.message });
      }
    }

    return { results };
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(dto: SendBulkNotificationDto): Promise<any> {
    this.logger.log(`Sending bulk ${dto.channel} notifications to ${dto.recipients.length} recipients`);

    const results = [];

    for (const recipient of dto.recipients) {
      try {
        const result = await this.send({
          business_id: dto.business_id,
          tenant_id: dto.tenant_id,
          customer_id: recipient.customer_id,
          user_id: recipient.user_id,
          recipient_email: recipient.recipient_email,
          recipient_phone: recipient.recipient_phone,
          recipient_name: recipient.recipient_name,
          template_key: dto.template_key,
          channel: dto.channel,
          context_data: recipient.context_data,
          priority: dto.priority || NotificationPriority.BATCH,
        });

        results.push({
          recipient: recipient.recipient_email || recipient.recipient_phone,
          success: true,
          notification_id: result.notification_id,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send to ${recipient.recipient_email || recipient.recipient_phone}: ${error.message}`,
        );
        results.push({
          recipient: recipient.recipient_email || recipient.recipient_phone,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      total: dto.recipients.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Queue notification for async processing
   */
  private async queueNotification(notificationId: string): Promise<void> {
    await this.notificationQueue.add(
      'send-notification',
      { notificationId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    await this.repository.updateMessageStatus(notificationId, NotificationStatus.QUEUED);
    this.logger.log(`Notification ${notificationId} queued for processing`);
  }

  /**
   * Send notification immediately (synchronous)
   */
  async sendImmediately(notificationId: string): Promise<void> {
    const notification = await this.repository.findMessageById(notificationId);
    if (!notification) {
      throw new NotFoundException(`Notification not found: ${notificationId}`);
    }

    try {
      await this.repository.updateMessageStatus(notificationId, NotificationStatus.QUEUED);

      let result: any;

      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailService.sendEmail({
            to: notification.recipient_email!,
            subject: notification.subject!,
            body: notification.body!,
            html: notification.html_body,
          });
          break;

        case NotificationChannel.SMS:
          result = await this.smsService.sendSms({
            to: notification.recipient_phone!,
            body: notification.body!,
          });
          break;

        case NotificationChannel.WHATSAPP:
          result = await this.whatsappService.sendWhatsApp({
            to: notification.recipient_phone!,
            body: notification.body!,
          });
          break;

        case NotificationChannel.PUSH:
          // TODO: Implement push notification service
          throw new Error('Push notifications not yet implemented');

        default:
          throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      // Update notification as sent
      await this.repository.updateMessageStatus(notificationId, NotificationStatus.SENT, {
        provider: this.getProvider(notification.channel),
        provider_message_id: result.messageId,
        provider_response: result,
      });

      // Create event log
      await this.repository.createEvent({
        notification_id: notificationId,
        event_type: NotificationEventType.SENT,
        event_data: result,
      });

      this.logger.log(`Notification ${notificationId} sent successfully via ${notification.channel}`);
    } catch (error) {
      this.logger.error(`Failed to send notification ${notificationId}: ${error.message}`, error.stack);

      // Increment retry count
      const updated = await this.repository.incrementRetryCount(notificationId);

      // Mark as failed if max retries exceeded
      if (updated.retry_count >= updated.max_retries) {
        await this.repository.updateMessageStatus(notificationId, NotificationStatus.FAILED, {
          error_message: error.message,
          error_code: error.code,
        });
      }

      throw error;
    }
  }

  /**
   * Validate recipient based on channel
   */
  private validateRecipient(channel: NotificationChannel, dto: SendNotificationDto): void {
    switch (channel) {
      case NotificationChannel.EMAIL:
        if (!dto.recipient_email) {
          throw new BadRequestException('recipient_email required for email channel');
        }
        break;
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        if (!dto.recipient_phone) {
          throw new BadRequestException(
            `recipient_phone required for ${channel} channel`,
          );
        }
        break;
    }
  }

  /**
   * Get provider name based on channel
   */
  private getProvider(channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return 'nodemailer';
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        return 'twilio';
      case NotificationChannel.PUSH:
        return 'firebase';
      default:
        return 'unknown';
    }
  }

  /**
   * Get notification by ID
   */
  async findById(id: string) {
    return await this.repository.findMessageById(id);
  }

  /**
   * Get notifications by status
   */
  async findByStatus(status: string) {
    return await this.repository.findMessagesByStatus(status);
  }
}
