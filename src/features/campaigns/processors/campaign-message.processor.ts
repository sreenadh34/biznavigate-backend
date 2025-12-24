import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppSenderService } from '../application/services/whatsapp-sender.service';

/**
 * Campaign Message Processor
 * Processes campaign messages from BullMQ queue for scalable delivery
 * Handles thousands of messages concurrently with rate limiting
 */
@Processor('campaign-messages', {
  concurrency: 10, // Process 10 messages concurrently
  limiter: {
    max: 100, // Max 100 jobs
    duration: 10000, // Per 10 seconds = 600 messages/min
  },
})
export class CampaignMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignMessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSender: WhatsAppSenderService,
  ) {
    super();
  }

  /**
   * Process individual campaign message
   */
  async process(job: Job<any>): Promise<any> {
    const { campaignId, recipientId, contact, campaign } = job.data;

    this.logger.log(
      `Processing campaign ${campaignId} for recipient ${contact.phone}`,
    );

    try {
      // Update recipient status to queued
      await this.prisma.campaign_recipients.update({
        where: { recipient_id: recipientId },
        data: {
          status: 'queued',
          updated_at: new Date(),
        },
      });

      // Send message based on channel
      let result;
      switch (campaign.channel) {
        case 'whatsapp':
          result = await this.sendWhatsAppMessage(
            contact,
            campaign,
            recipientId,
          );
          break;

        case 'email':
          result = await this.sendEmailMessage(contact, campaign, recipientId);
          break;

        case 'sms':
          result = await this.sendSMSMessage(contact, campaign, recipientId);
          break;

        default:
          throw new Error(`Unsupported channel: ${campaign.channel}`);
      }

      // Update recipient and campaign counters
      if (result.success) {
        await Promise.all([
          // Update recipient
          this.prisma.campaign_recipients.update({
            where: { recipient_id: recipientId },
            data: {
              status: 'sent',
              sent_at: new Date(),
              whatsapp_message_id: result.messageId || null,
              updated_at: new Date(),
            },
          }),
          // Increment campaign sent count
          this.prisma.campaigns.update({
            where: { campaign_id: campaignId },
            data: {
              sent_count: { increment: 1 },
              updated_at: new Date(),
            },
          }),
        ]);

        this.logger.log(
          `Successfully sent campaign message to ${contact.phone}`,
        );
      } else {
        // Handle failure
        await Promise.all([
          // Update recipient with error
          this.prisma.campaign_recipients.update({
            where: { recipient_id: recipientId },
            data: {
              status: 'failed',
              error_message: result.error || 'Unknown error',
              updated_at: new Date(),
            },
          }),
          // Increment campaign failed count
          this.prisma.campaigns.update({
            where: { campaign_id: campaignId },
            data: {
              failed_count: { increment: 1 },
              updated_at: new Date(),
            },
          }),
        ]);

        this.logger.error(
          `Failed to send campaign message to ${contact.phone}: ${result.error}`,
        );
      }

      // Check if campaign is complete
      await this.checkCampaignCompletion(campaignId);

      return result;
    } catch (error) {
      this.logger.error(
        `Error processing campaign message for ${contact.phone}:`,
        error,
      );

      // Update recipient as failed
      await this.prisma.campaign_recipients.update({
        where: { recipient_id: recipientId },
        data: {
          status: 'failed',
          error_message: error.message,
          updated_at: new Date(),
        },
      });

      throw error; // Will trigger retry if attempts remaining
    }
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsAppMessage(contact: any, campaign: any, recipientId: string) {
    // Use template if specified
    if (campaign.templateName) {
      // Replace template parameters with contact data if needed
      const parameters = this.replacePlaceholders(
        campaign.templateParameters || [],
        contact,
      );

      return await this.whatsappSender.sendTemplateMessage({
        to: contact.phone,
        templateName: campaign.templateName,
        templateLanguage: campaign.templateLanguage || 'en',
        parameters,
        mediaUrl: campaign.mediaUrl,
        mediaType: campaign.mediaType,
        businessId: campaign.businessId,
      });
    } else if (campaign.contentTemplate) {
      // Send as text message (requires active 24hr session)
      const message = this.replacePlaceholders(
        campaign.contentTemplate,
        contact,
      );

      return await this.whatsappSender.sendTextMessage({
        to: contact.phone,
        message,
        businessId: campaign.businessId,
      });
    } else {
      throw new Error('No template or content specified for WhatsApp campaign');
    }
  }

  /**
   * Send Email message (placeholder - implement with your email service)
   */
  private async sendEmailMessage(contact: any, campaign: any, recipientId: string) {
    // TODO: Implement email sending
    this.logger.warn('Email sending not yet implemented');
    return { success: false, error: 'Email sending not implemented' };
  }

  /**
   * Send SMS message (disabled - use WhatsApp Business API instead)
   */
  private async sendSMSMessage(_contact: any, _campaign: any, _recipientId: string) {
    this.logger.warn('SMS sending is disabled. Use WhatsApp Business API instead.');
    return { success: false, error: 'SMS sending is disabled' };
  }

  /**
   * Replace placeholders in template with actual contact data
   * Supports {{name}}, {{firstName}}, {{phone}}, etc.
   */
  private replacePlaceholders(template: any, contact: any): any {
    if (Array.isArray(template)) {
      return template.map((param) => this.replacePlaceholders(param, contact));
    }

    if (typeof template === 'string') {
      return template
        .replace(/\{\{name\}\}/g, contact.name || 'Customer')
        .replace(/\{\{firstName\}\}/g, contact.name?.split(' ')[0] || 'Customer')
        .replace(/\{\{phone\}\}/g, contact.phone || '')
        .replace(/\{\{email\}\}/g, contact.email || '');
    }

    return template;
  }

  /**
   * Check if campaign is complete and update status
   */
  private async checkCampaignCompletion(campaignId: string) {
    const campaign = await this.prisma.campaigns.findUnique({
      where: { campaign_id: campaignId },
      select: {
        total_recipients: true,
        sent_count: true,
        failed_count: true,
        status: true,
      },
    });

    if (!campaign) return;

    const totalProcessed = (campaign.sent_count || 0) + (campaign.failed_count || 0);

    // If all recipients have been processed
    if (totalProcessed >= (campaign.total_recipients || 0)) {
      await this.prisma.campaigns.update({
        where: { campaign_id: campaignId },
        data: {
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Campaign ${campaignId} completed. Sent: ${campaign.sent_count}, Failed: ${campaign.failed_count}`,
      );
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed for campaign ${job.data.campaignId}`);
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for campaign ${job.data.campaignId}:`,
      error.message,
    );
  }
}
