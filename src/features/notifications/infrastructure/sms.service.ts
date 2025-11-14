import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

/**
 * SMS Service
 * Handles SMS sending via Twilio
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTwilio();
  }

  private initializeTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !this.fromNumber) {
      this.logger.warn('Twilio configuration missing. SMS sending will be disabled.');
      return;
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    this.logger.log(`SMS service initialized with Twilio number: ${this.fromNumber}`);
  }

  /**
   * Send SMS
   */
  async sendSms(options: SmsOptions): Promise<SmsResponse> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check Twilio configuration.');
    }

    try {
      // Ensure phone number has country code
      const toNumber = this.formatPhoneNumber(options.to);

      const message = await this.twilioClient.messages.create({
        body: options.body,
        from: this.fromNumber,
        to: toNumber,
      });

      this.logger.log(`SMS sent successfully to ${options.to}. SID: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        response: message,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${options.to}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Format phone number to E.164 format
   * Assumes Indian numbers if no country code provided
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If it starts with +, keep it
    if (phone.startsWith('+')) {
      return '+' + cleaned;
    }

    // If it's 10 digits, assume Indian number
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }

    // If it already has country code, add +
    if (cleaned.length > 10) {
      return '+' + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Get SMS delivery status
   */
  async getSmsStatus(messageSid: string): Promise<string> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized.');
    }

    try {
      const message = await this.twilioClient.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      this.logger.error(`Failed to fetch SMS status for ${messageSid}: ${error.message}`);
      throw error;
    }
  }
}

export interface SmsOptions {
  to: string;
  body: string;
}

export interface SmsResponse {
  success: boolean;
  messageId: string;
  status: string;
  response: any;
}
