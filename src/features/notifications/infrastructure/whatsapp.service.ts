import { Injectable, Logger } from '@nestjs/common';

/**
 * WhatsApp Service (Notifications Module)
 * This service is deprecated. Use the main WhatsApp module instead:
 * /features/whatsapp/whatsapp.service.ts
 *
 * The main WhatsApp module uses Meta WhatsApp Business Cloud API
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor() {
    this.logger.warn(
      'This WhatsApp service is deprecated. Use the main WhatsApp module at /features/whatsapp instead.'
    );
  }

  /**
   * Send WhatsApp message - Use main WhatsApp module instead
   */
  async sendWhatsApp(_options: WhatsAppOptions): Promise<WhatsAppResponse> {
    throw new Error(
      'This WhatsApp service is deprecated. Use the main WhatsApp module at /features/whatsapp instead.'
    );
  }

  /**
   * Send WhatsApp template message - Use main WhatsApp module instead
   */
  async sendTemplateMessage(_options: WhatsAppTemplateOptions): Promise<WhatsAppResponse> {
    throw new Error(
      'This WhatsApp service is deprecated. Use the main WhatsApp module at /features/whatsapp instead.'
    );
  }

  /**
   * Get WhatsApp message status - Use main WhatsApp module instead
   */
  async getMessageStatus(_messageSid: string): Promise<string> {
    throw new Error(
      'This WhatsApp service is deprecated. Use the main WhatsApp module at /features/whatsapp instead.'
    );
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
