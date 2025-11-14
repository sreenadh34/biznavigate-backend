import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * WhatsApp Sender Service
 * Handles WhatsApp Business API message sending with rate limiting
 */
@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);
  private readonly whatsappApiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
  private readonly whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Rate limiting: Track last send time per business
  private lastSendTime = new Map<string, number>();
  private readonly minDelayMs = 100; // 100ms between messages = 600 msg/min = 10 msg/sec

  /**
   * Send template message via WhatsApp Business API
   */
  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    templateLanguage: string;
    parameters?: any[];
    mediaUrl?: string;
    mediaType?: string;
    businessId: string;
  }) {
    try {
      // Rate limiting per business
      await this.rateLimit(params.businessId);

      // Format phone number (remove +, spaces, etc.)
      const phone = this.formatPhoneNumber(params.to);

      // Build template components
      const components: any[] = [];

      // Header component (if media)
      if (params.mediaUrl && params.mediaType) {
        components.push({
          type: 'header',
          parameters: [
            {
              type: params.mediaType, // 'image', 'video', 'document'
              [params.mediaType]: {
                link: params.mediaUrl,
              },
            },
          ],
        });
      }

      // Body component (template variables)
      if (params.parameters && params.parameters.length > 0) {
        components.push({
          type: 'body',
          parameters: params.parameters.map((param) => ({
            type: 'text',
            text: String(param),
          })),
        });
      }

      // Send message via WhatsApp Business API
      const response = await axios.post(
        `${this.whatsappApiUrl}/${this.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: params.templateName,
            language: {
              code: params.templateLanguage,
            },
            components: components.length > 0 ? components : undefined,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `WhatsApp message sent to ${phone}, Message ID: ${response.data.messages?.[0]?.id}`,
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        phone,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${params.to}:`,
        error.response?.data || error.message,
      );

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorCode: error.response?.data?.error?.code,
        phone: params.to,
      };
    }
  }

  /**
   * Send text message (non-template) - for businesses with approved session
   */
  async sendTextMessage(params: {
    to: string;
    message: string;
    businessId: string;
  }) {
    try {
      await this.rateLimit(params.businessId);

      const phone = this.formatPhoneNumber(params.to);

      const response = await axios.post(
        `${this.whatsappApiUrl}/${this.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: {
            body: params.message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `WhatsApp text message sent to ${phone}, Message ID: ${response.data.messages?.[0]?.id}`,
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        phone,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp text to ${params.to}:`,
        error.response?.data || error.message,
      );

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorCode: error.response?.data?.error?.code,
        phone: params.to,
      };
    }
  }

  /**
   * Send media message (image/video/document)
   */
  async sendMediaMessage(params: {
    to: string;
    mediaUrl: string;
    mediaType: 'image' | 'video' | 'document';
    caption?: string;
    businessId: string;
  }) {
    try {
      await this.rateLimit(params.businessId);

      const phone = this.formatPhoneNumber(params.to);

      const payload: any = {
        messaging_product: 'whatsapp',
        to: phone,
        type: params.mediaType,
        [params.mediaType]: {
          link: params.mediaUrl,
        },
      };

      if (params.caption) {
        payload[params.mediaType].caption = params.caption;
      }

      const response = await axios.post(
        `${this.whatsappApiUrl}/${this.whatsappPhoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `WhatsApp ${params.mediaType} sent to ${phone}, Message ID: ${response.data.messages?.[0]?.id}`,
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        phone,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp ${params.mediaType} to ${params.to}:`,
        error.response?.data || error.message,
      );

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        errorCode: error.response?.data?.error?.code,
        phone: params.to,
      };
    }
  }

  /**
   * Rate limiting: Ensure minimum delay between messages
   */
  private async rateLimit(businessId: string): Promise<void> {
    const now = Date.now();
    const lastSend = this.lastSendTime.get(businessId) || 0;
    const timeSinceLastSend = now - lastSend;

    if (timeSinceLastSend < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastSend;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastSendTime.set(businessId, Date.now());
  }

  /**
   * Format phone number to E.164 format
   * Removes spaces, dashes, and ensures country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Add country code if missing (default to India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if WhatsApp credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.whatsappToken && this.whatsappPhoneNumberId);
  }

  /**
   * Get WhatsApp Business API configuration status
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.whatsappToken,
      hasPhoneNumberId: !!this.whatsappPhoneNumberId,
      apiUrl: this.whatsappApiUrl,
    };
  }
}
