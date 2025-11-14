import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateValidationService } from './template-validation.service';
import {
  TemplatePreviewDto,
  SendTestNotificationDto,
  NotificationChannel,
  TemplateVariableDto,
} from '../dto/template.dto';

/**
 * Template Preview and Rendering Service
 * Handles template preview, testing, and variable replacement
 */
@Injectable()
export class TemplatePreviewService {
  private readonly logger = new Logger(TemplatePreviewService.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly validationService: TemplateValidationService,
  ) {}

  /**
   * Preview template with variables
   */
  async previewTemplate(dto: TemplatePreviewDto) {
    this.logger.log(`Previewing template: ${dto.templateId} for channel: ${dto.channel}`);

    // Get template
    const template = await this.templateService.getTemplateById(dto.templateId);

    // Check if channel is enabled
    const enabledChannels = template.enabled_channels as string[];
    if (!enabledChannels.includes(dto.channel)) {
      throw new BadRequestException(
        `Channel '${dto.channel}' is not enabled for this template`,
      );
    }

    // Validate provided variables
    const variables = (template.variables as any) as TemplateVariableDto[];
    const validation = this.validationService.validateAllVariables(dto.variables, variables);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid variables provided',
        errors: validation.errors,
      });
    }

    // Render template based on channel
    let preview: any = {
      channel: dto.channel,
      templateId: template.template_id,
      templateName: template.template_name,
    };

    switch (dto.channel) {
      case NotificationChannel.EMAIL:
        preview.subject = this.renderContent(
          template.email_subject || '',
          dto.variables,
          variables,
        );
        preview.body = this.renderContent(template.email_body || '', dto.variables, variables);
        preview.html = template.email_html
          ? this.validationService.sanitizeHtml(
              this.renderContent(template.email_html, dto.variables, variables),
            )
          : null;
        break;

      case NotificationChannel.SMS:
        const smsContent = this.renderContent(
          template.sms_body || '',
          dto.variables,
          variables,
        );
        preview.body = smsContent;
        preview.length = smsContent.length;
        preview.segments = this.calculateSmsSegments(smsContent.length);
        break;

      case NotificationChannel.WHATSAPP:
        preview.body = this.renderContent(
          template.whatsapp_body || '',
          dto.variables,
          variables,
        );
        break;

      case NotificationChannel.PUSH:
        preview.title = this.renderContent(template.push_title || '', dto.variables, variables);
        preview.body = this.renderContent(template.push_body || '', dto.variables, variables);
        break;
    }

    return {
      ...preview,
      variables: dto.variables,
      detectedVariables: this.validationService.extractVariables(
        this.getContentForChannel(template, dto.channel),
      ),
    };
  }

  /**
   * Send test notification
   */
  async sendTestNotification(dto: SendTestNotificationDto) {
    this.logger.log(`Sending test notification for template: ${dto.templateId}`);

    // Get preview first
    const preview = await this.previewTemplate(dto);

    // Validate recipient based on channel
    this.validateTestRecipient(dto);

    // In a real implementation, this would send actual notifications
    // For now, we'll return the preview with send confirmation

    this.logger.log(`Test notification would be sent to ${this.getRecipient(dto)}`);

    return {
      success: true,
      message: `Test notification queued for ${dto.channel}`,
      recipient: this.getRecipient(dto),
      preview,
      // In production, add actual sending logic here:
      // - Email: via nodemailer or AWS SES
      // - SMS: via Twilio or similar
      // - WhatsApp: via WhatsApp Business API
      // - Push: via FCM or similar
    };
  }

  /**
   * Batch preview multiple variables
   */
  async batchPreview(
    templateId: string,
    channel: NotificationChannel,
    variableSets: Record<string, any>[],
  ) {
    const previews = [];

    for (const variables of variableSets) {
      try {
        const preview = await this.previewTemplate({
          templateId,
          channel,
          variables,
        });
        previews.push({ success: true, preview });
      } catch (error) {
        previews.push({
          success: false,
          error: error.message,
          variables,
        });
      }
    }

    return {
      total: variableSets.length,
      successful: previews.filter((p) => p.success).length,
      failed: previews.filter((p) => !p.success).length,
      previews,
    };
  }

  /**
   * Get sample preview with example values
   */
  async getSamplePreview(templateId: string, channel: NotificationChannel) {
    const template = await this.templateService.getTemplateById(templateId);
    const variables = (template.variables as any) as TemplateVariableDto[];

    // Build sample variables using example values
    const sampleVariables: Record<string, any> = {};
    variables.forEach((variable) => {
      sampleVariables[variable.key] =
        variable.exampleValue || variable.defaultValue || `[${variable.label}]`;
    });

    return this.previewTemplate({
      templateId,
      channel,
      variables: sampleVariables,
    });
  }

  /**
   * Compare template versions (useful for A/B testing)
   */
  async compareTemplates(
    templateId1: string,
    templateId2: string,
    channel: NotificationChannel,
    variables: Record<string, any>,
  ) {
    const preview1 = await this.previewTemplate({
      templateId: templateId1,
      channel,
      variables,
    });

    const preview2 = await this.previewTemplate({
      templateId: templateId2,
      channel,
      variables,
    });

    return {
      template1: preview1,
      template2: preview2,
      comparison: {
        channel,
        variables,
        differences: this.highlightDifferences(preview1, preview2, channel),
      },
    };
  }

  /**
   * Render content with variables
   */
  private renderContent(
    content: string,
    variables: Record<string, any>,
    definedVariables: TemplateVariableDto[],
  ): string {
    return this.validationService.replaceVariables(content, variables, definedVariables);
  }

  /**
   * Get content for specific channel
   */
  private getContentForChannel(template: any, channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return `${template.email_subject || ''} ${template.email_body || ''} ${template.email_html || ''}`;
      case NotificationChannel.SMS:
        return template.sms_body || '';
      case NotificationChannel.WHATSAPP:
        return template.whatsapp_body || '';
      case NotificationChannel.PUSH:
        return `${template.push_title || ''} ${template.push_body || ''}`;
      default:
        return '';
    }
  }

  /**
   * Calculate SMS segments
   */
  private calculateSmsSegments(length: number): number {
    if (length === 0) return 0;
    if (length <= 160) return 1;
    return Math.ceil(length / 153); // 153 chars per segment for multi-part SMS
  }

  /**
   * Validate test recipient
   */
  private validateTestRecipient(dto: SendTestNotificationDto) {
    switch (dto.channel) {
      case NotificationChannel.EMAIL:
        if (!dto.testEmail) {
          throw new BadRequestException('Test email is required for email channel');
        }
        break;

      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        if (!dto.testPhone) {
          throw new BadRequestException(
            `Test phone is required for ${dto.channel} channel`,
          );
        }
        break;

      case NotificationChannel.PUSH:
        if (!dto.testDeviceToken) {
          throw new BadRequestException('Test device token is required for push channel');
        }
        break;
    }
  }

  /**
   * Get recipient string
   */
  private getRecipient(dto: SendTestNotificationDto): string {
    switch (dto.channel) {
      case NotificationChannel.EMAIL:
        return dto.testEmail || '';
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        return dto.testPhone || '';
      case NotificationChannel.PUSH:
        return dto.testDeviceToken || '';
      default:
        return '';
    }
  }

  /**
   * Highlight differences between two previews
   */
  private highlightDifferences(preview1: any, preview2: any, channel: NotificationChannel) {
    const differences: any = {};

    if (channel === NotificationChannel.EMAIL) {
      if (preview1.subject !== preview2.subject) {
        differences.subject = {
          template1: preview1.subject,
          template2: preview2.subject,
        };
      }
      if (preview1.body !== preview2.body) {
        differences.body = {
          template1: preview1.body,
          template2: preview2.body,
          lengthDiff: preview2.body.length - preview1.body.length,
        };
      }
    } else if (channel === NotificationChannel.SMS) {
      differences.body = {
        template1: preview1.body,
        template2: preview2.body,
        lengthDiff: preview2.body.length - preview1.body.length,
        segmentDiff: preview2.segments - preview1.segments,
      };
    } else if (channel === NotificationChannel.WHATSAPP) {
      differences.body = {
        template1: preview1.body,
        template2: preview2.body,
        lengthDiff: preview2.body.length - preview1.body.length,
      };
    } else if (channel === NotificationChannel.PUSH) {
      if (preview1.title !== preview2.title) {
        differences.title = {
          template1: preview1.title,
          template2: preview2.title,
        };
      }
      if (preview1.body !== preview2.body) {
        differences.body = {
          template1: preview1.body,
          template2: preview2.body,
        };
      }
    }

    return differences;
  }

  /**
   * Export template as JSON
   */
  async exportTemplate(templateId: string) {
    const template = await this.templateService.getTemplateById(templateId);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      template: {
        templateKey: template.template_key,
        templateName: template.template_name,
        description: template.description,
        emailSubject: template.email_subject,
        emailBody: template.email_body,
        emailHtml: template.email_html,
        smsBody: template.sms_body,
        whatsappBody: template.whatsapp_body,
        pushTitle: template.push_title,
        pushBody: template.push_body,
        variables: template.variables,
        enabledChannels: template.enabled_channels,
      },
    };
  }
}
