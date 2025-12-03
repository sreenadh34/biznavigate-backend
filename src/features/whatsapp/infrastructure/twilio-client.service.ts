import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioClientService {
  private readonly logger = new Logger(TwilioClientService.name);
  private readonly twilioClient: Twilio;
  private readonly fromWhatsAppNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured. WhatsApp messaging will not work.');
    }

    this.twilioClient = new Twilio(accountSid, authToken);
  }

  /**
   * Send WhatsApp message via Twilio
   */
  async sendWhatsAppMessage(to: string, body: string): Promise<any> {
    try {
      // Format phone number for WhatsApp (must include whatsapp: prefix)
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      this.logger.log(`Sending WhatsApp message to ${formattedTo}`);

      const message = await this.twilioClient.messages.create({
        body,
        from: this.fromWhatsAppNumber,
        to: formattedTo,
      });

      this.logger.log(`Message sent successfully: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateSent: message.dateSent,
      };
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message via Twilio:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message with media via Twilio
   */
  async sendWhatsAppMessageWithMedia(
    to: string,
    body: string,
    mediaUrl: string[],
  ): Promise<any> {
    try {
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      this.logger.log(`Sending WhatsApp message with media to ${formattedTo}`);

      const message = await this.twilioClient.messages.create({
        body,
        from: this.fromWhatsAppNumber,
        to: formattedTo,
        mediaUrl,
      });

      this.logger.log(`Message with media sent successfully: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        numMedia: message.numMedia,
        dateSent: message.dateSent,
      };
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message with media via Twilio:', error);
      throw error;
    }
  }

  /**
   * Get message status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<any> {
    try {
      const message = await this.twilioClient.messages(messageSid).fetch();

      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        dateSent: message.dateSent,
      };
    } catch (error) {
      this.logger.error(`Failed to get message status for ${messageSid}:`, error);
      throw error;
    }
  }

  /**
   * Send WhatsApp template message via Twilio
   * Note: Twilio uses approved content templates
   */
  async sendTemplateMessage(
    to: string,
    contentSid: string,
    contentVariables?: Record<string, string>,
  ): Promise<any> {
    try {
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      this.logger.log(`Sending WhatsApp template message to ${formattedTo}`);

      const messageOptions: any = {
        from: this.fromWhatsAppNumber,
        to: formattedTo,
        contentSid,
      };

      if (contentVariables) {
        messageOptions.contentVariables = JSON.stringify(contentVariables);
      }

      const message = await this.twilioClient.messages.create(messageOptions);

      this.logger.log(`Template message sent successfully: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        dateSent: message.dateSent,
      };
    } catch (error) {
      this.logger.error('Failed to send WhatsApp template message via Twilio:', error);
      throw error;
    }
  }
}
