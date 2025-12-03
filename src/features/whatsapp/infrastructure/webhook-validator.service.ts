import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookValidatorService {
  private readonly logger = new Logger(WebhookValidatorService.name);
  private readonly appSecret: string;
  private readonly verifyToken: string;

  constructor(private readonly configService: ConfigService) {
    this.appSecret = this.configService.get<string>('whatsapp.appSecret');
    this.verifyToken = this.configService.get<string>('whatsapp.webhookVerifyToken');
  }

  /**
   * Verify webhook signature from WhatsApp
   * WhatsApp sends X-Hub-Signature-256 header with SHA256 HMAC
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!signature) {
      this.logger.warn('No signature provided in webhook request');
      return false;
    }

    // Signature format: sha256=<hash>
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      this.logger.warn('Invalid signature format');
      return false;
    }

    const expectedHash = signatureParts[1];

    // Calculate HMAC using app secret
    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(payload);
    const calculatedHash = hmac.digest('hex');

    this.logger.debug(`Expected hash: ${expectedHash}`);
    this.logger.debug(`Calculated hash: ${calculatedHash}`);
    this.logger.debug(`App secret: ${this.appSecret?.substring(0, 10)}...`);
    this.logger.debug(`Payload length: ${payload?.length}`);

    // Compare using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(calculatedHash, 'hex'),
    );

    if (!isValid) {
      this.logger.warn('Webhook signature verification failed');
    } else {
      this.logger.log('Webhook signature verified successfully');
    }

    return isValid;
  }

  /**
   * Verify webhook challenge for initial setup
   * WhatsApp sends hub.mode, hub.verify_token, and hub.challenge
   */
  verifyChallenge(mode: string, token: string, challenge: string): string | null {
    this.logger.log(`Verifying webhook challenge:`);
    this.logger.log(`  Mode: ${mode}`);
    this.logger.log(`  Token received: ${token}`);
    this.logger.log(`  Expected token: ${this.verifyToken}`);
    this.logger.log(`  Challenge: ${challenge}`);

    if (mode !== 'subscribe') {
      this.logger.warn(`Invalid webhook mode: ${mode}`);
      return null;
    }

    if (token !== this.verifyToken) {
      this.logger.warn(`Invalid verify token. Received: "${token}", Expected: "${this.verifyToken}"`);
      return null;
    }

    this.logger.log('✅ Webhook verification successful');
    return challenge;
  }

  /**
   * Validate webhook event structure
   */
  validateWebhookEvent(event: any): boolean {
    if (!event || typeof event !== 'object') {
      this.logger.warn('Invalid webhook event structure');
      return false;
    }

    if (!event.object || !event.entry || !Array.isArray(event.entry)) {
      this.logger.warn('Missing required webhook fields');
      return false;
    }

    if (event.object !== 'whatsapp_business_account') {
      this.logger.warn('Invalid webhook object type:', event.object);
      return false;
    }

    return true;
  }

  /**
   * Extract and validate changes from entry
   */
  extractChanges(entry: any): any[] {
    if (!entry.changes || !Array.isArray(entry.changes)) {
      this.logger.warn('No changes found in webhook entry');
      return [];
    }

    return entry.changes.filter((change) => {
      if (!change.field || !change.value) {
        this.logger.warn('Invalid change structure:', change);
        return false;
      }
      return true;
    });
  }

  /**
   * Extract messages from webhook value
   */
  extractMessages(value: any): any[] {
    if (!value.messages || !Array.isArray(value.messages)) {
      return [];
    }

    return value.messages;
  }

  /**
   * Extract statuses from webhook value
   */
  extractStatuses(value: any): any[] {
    if (!value.statuses || !Array.isArray(value.statuses)) {
      return [];
    }

    return value.statuses;
  }
}
