import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS Service
 * SMS sending is currently disabled. Use WhatsApp Business API instead.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor() {
    this.logger.warn('SMS service is disabled. Use WhatsApp Business API for messaging.');
  }

  /**
   * Send SMS - Disabled
   */
  async sendSms(_options: SmsOptions): Promise<SmsResponse> {
    throw new Error('SMS service is disabled. Use WhatsApp Business API instead.');
  }

  /**
   * Get SMS delivery status - Disabled
   */
  async getSmsStatus(_messageSid: string): Promise<string> {
    throw new Error('SMS service is disabled.');
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
