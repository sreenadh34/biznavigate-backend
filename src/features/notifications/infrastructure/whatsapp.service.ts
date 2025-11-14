import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

/**
 * WhatsApp Service
 * Handles WhatsApp messages via Twilio WhatsApp API
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTwilio();
  }

  private initializeTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const whatsappNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER');

    if (!accountSid || !authToken || !whatsappNumber) {
      this.logger.warn('Twilio WhatsApp configuration missing. WhatsApp sending will be disabled.');
      return;
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    // Twilio WhatsApp numbers must be in format: whatsapp:+14155238886
    this.fromNumber = whatsappNumber.startsWith('whatsapp:')
      ? whatsappNumber
      : `whatsapp:${whatsappNumber}`;

    this.logger.log(`WhatsApp service initialized with number: ${this.fromNumber}`);
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(options: WhatsAppOptions): Promise<WhatsAppResponse> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check WhatsApp configuration.');
    }

    try {
      const toNumber = this.formatWhatsAppNumber(options.to);

      const message = await this.twilioClient.messages.create({
        body: options.body,
        from: this.fromNumber,
        to: toNumber,
      });

      this.logger.log(`WhatsApp message sent successfully to ${options.to}. SID: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        response: message,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${options.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send WhatsApp template message (for pre-approved templates)
   */
  async sendTemplateMessage(options: WhatsAppTemplateOptions): Promise<WhatsAppResponse> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized.');
    }

    try {
      const toNumber = this.formatWhatsAppNumber(options.to);

      const message = await this.twilioClient.messages.create({
        contentSid: options.templateSid,
        contentVariables: JSON.stringify(options.variables || {}),
        from: this.fromNumber,
        to: toNumber,
      });

      this.logger.log(
        `WhatsApp template message sent successfully to ${options.to}. SID: ${message.sid}`,
      );

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        response: message,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp template to ${options.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Format phone number for WhatsApp (whatsapp:+<country_code><number>)
   */
  private formatWhatsAppNumber(phone: string): string {
    // If already in whatsapp format, return as is
    if (phone.startsWith('whatsapp:')) {
      return phone;
    }

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Add + if not present
    if (!cleaned.startsWith('+')) {
      // If it's 10 digits, assume Indian number
      if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    return `whatsapp:${cleaned}`;
  }

  /**
   * Get WhatsApp message status
   */
  async getMessageStatus(messageSid: string): Promise<string> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized.');
    }

    try {
      const message = await this.twilioClient.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      this.logger.error(`Failed to fetch WhatsApp message status for ${messageSid}: ${error.message}`);
      throw error;
    }
  }
}

export interface WhatsAppOptions {
  to: string;
  body: string;
}

export interface WhatsAppTemplateOptions {
  to: string;
  templateSid: string;
  variables?: Record<string, string>;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId: string;
  status: string;
  response: any;
}
