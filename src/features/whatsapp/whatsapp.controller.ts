import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { WebhookValidatorService } from './infrastructure/webhook-validator.service';
import {
  WhatsAppWebhookDto,
  WebhookVerificationDto,
} from './dto/webhook-event.dto';
import {
  SendWhatsAppMessageDto,
} from './dto/whatsapp-message.dto';
import {
  ConnectWhatsAppAccountDto,
  DisconnectWhatsAppAccountDto,
  GetAccountsDto,
} from './dto/whatsapp-auth.dto';

interface RawBodyRequest<T> extends Request {
  rawBody?: Buffer;
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly webhookValidator: WebhookValidatorService,
  ) {}

  // ==================== Account Management ====================

  @Post('accounts/connect')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect WhatsApp Business Account' })
  @ApiResponse({ status: 201, description: 'Account connected successfully' })
  async connectAccount(@Body() dto: ConnectWhatsAppAccountDto) {
    this.logger.log(`Connecting WhatsApp account for business ${dto.businessId}`);

    return this.whatsappService.connectWhatsAppAccount(
      dto.whatsappBusinessAccountId,
      dto.phoneNumberId,
      dto.accessToken,
      dto.businessId,
    );
  }

  @Get('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all WhatsApp accounts for a business' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  async getAccounts(@Query() dto: GetAccountsDto) {
    return this.whatsappService.getWhatsAppAccounts(dto.businessId);
  }

  @Delete('accounts/:accountId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect WhatsApp account' })
  @ApiResponse({ status: 200, description: 'Account disconnected successfully' })
  async disconnectAccount(
    @Param('accountId') accountId: string,
    @Body() dto: DisconnectWhatsAppAccountDto,
  ) {
    return this.whatsappService.disconnectAccount(accountId, dto.businessId);
  }

  // ==================== Webhooks ====================

  // ========== META WHATSAPP WEBHOOKS (COMMENTED OUT) ==========
  /*
  @Get('webhook/debug')
  @ApiOperation({ summary: 'Debug webhook configuration' })
  @ApiResponse({ status: 200, description: 'Config details' })
  debugWebhookConfig() {
    return {
      hasVerifyToken: !!process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      verifyTokenLength: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN?.length || 0,
      verifyTokenValue: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      hasAppId: !!process.env.FACEBOOK_APP_ID,
      hasAppSecret: !!process.env.FACEBOOK_APP_SECRET,
    };
  }

  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify webhook (GET)' })
  @ApiResponse({ status: 200, description: 'Webhook verified' })
  async verifyWebhook(@Query() query: WebhookVerificationDto, @Res() res: Response) {
    this.logger.log('🔔 Webhook verification request received');
    this.logger.log(`Query params: ${JSON.stringify(query)}`);

    const challenge = this.webhookValidator.verifyChallenge(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );

    if (!challenge) {
      throw new BadRequestException('Webhook verification failed');
    }

    this.logger.log('✅ Webhook verified successfully');

    // Return plain text response (bypass interceptor)
    // Facebook expects just the challenge string, not JSON
    res.status(200).send(challenge);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook events (POST)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Body() body: WhatsAppWebhookDto,
    @Headers('x-hub-signature-256') signature: string,
  ) {

    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(body);

    const isValid = this.webhookValidator.verifySignature(rawBody, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!this.webhookValidator.validateWebhookEvent(body)) {
      throw new BadRequestException('Invalid webhook event structure');
    }

    setImmediate(() => this.processWebhook(body));

    return { success: true };
  }
  */

  // ========== TWILIO WHATSAPP WEBHOOKS ==========

  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio webhook status endpoint (GET)' })
  @ApiResponse({ status: 200, description: 'Webhook is active' })
  async twilioWebhookStatus(@Res() res: Response) {
    this.logger.log('🔔 Twilio webhook status check');
    res.status(200).send('Twilio WhatsApp webhook is active');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Twilio WhatsApp webhook events (POST)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleTwilioWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
  ) {
    this.logger.log('📨 Received Twilio WhatsApp webhook');
    this.logger.debug('Webhook body:', JSON.stringify(body, null, 2));

    try {
      // Twilio sends form-encoded data, body will have these fields:
      // MessageSid, AccountSid, From, To, Body, NumMedia, etc.

      const {
        MessageSid,
        AccountSid,
        From,
        To,
        Body,
        NumMedia,
        MediaUrl0,
        MediaContentType0,
        ProfileName,
        WaId,
      } = body;

      this.logger.log(`Message from ${From} (${ProfileName || WaId}): ${Body}`);

      // Process the webhook asynchronously
      setImmediate(() => this.processTwilioWebhook(body));

      // Twilio expects a 200 response quickly
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      this.logger.error('Error handling Twilio webhook:', error);
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  // ==================== Messaging ====================

  @Post('messages/send')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(
    @Body() dto: { phoneNumberId: string; to: string; message: SendWhatsAppMessageDto },
  ) {
    return this.whatsappService.sendMessage(
      dto.phoneNumberId,
      dto.to,
      dto.message,
    );
  }

  @Post('messages/button')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a button message' })
  @ApiResponse({ status: 200, description: 'Button message sent successfully' })
  async sendButtonMessage(
    @Body() dto: {
      phoneNumberId: string;
      to: string;
      bodyText: string;
      buttons: { id: string; title: string }[];
      headerText?: string;
      footerText?: string;
    },
  ) {
    return this.whatsappService.sendButtonMessage(
      dto.phoneNumberId,
      dto.to,
      dto.bodyText,
      dto.buttons,
      dto.headerText,
      dto.footerText,
    );
  }

  @Post('messages/list')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a list message' })
  @ApiResponse({ status: 200, description: 'List message sent successfully' })
  async sendListMessage(
    @Body() dto: {
      phoneNumberId: string;
      to: string;
      bodyText: string;
      buttonText: string;
      sections: { title: string; rows: { id: string; title: string; description?: string }[] }[];
      headerText?: string;
      footerText?: string;
    },
  ) {
    return this.whatsappService.sendListMessage(
      dto.phoneNumberId,
      dto.to,
      dto.bodyText,
      dto.buttonText,
      dto.sections,
      dto.headerText,
      dto.footerText,
    );
  }

  // ==================== Private Methods ====================

  /**
   * Process webhook events (Meta WhatsApp - COMMENTED OUT)
   */
  /*
  private async processWebhook(webhookData: WhatsAppWebhookDto): Promise<void> {
    try {
      for (const entry of webhookData.entry) {
        const changes = this.webhookValidator.extractChanges(entry);

        console.log("chnages", changes);

        for (const change of changes) {
          const { value } = change;

          // Handle incoming messages
          const messages = this.webhookValidator.extractMessages(value);
          if (messages.length > 0) {
            for (const message of messages) {
              await this.whatsappService.handleMessageWebhook(
                message,
                value.metadata,
                value.contacts || [],
              );
            }
          }

          // Handle message statuses (sent, delivered, read, failed)
          const statuses = this.webhookValidator.extractStatuses(value);
          if (statuses.length > 0) {
            for (const status of statuses) {
              await this.whatsappService.handleStatusWebhook(status);
            }
          }
        }
      }
    } catch (error) {
      console.log("error", error);
      this.logger.error('Error processing webhook:', error);
    }
  }
  */

  /**
   * Process Twilio webhook events
   * Adapts Twilio format to Meta WhatsApp format to reuse existing service methods
   */
  private async processTwilioWebhook(twilioData: any): Promise<void> {
    try {
      const {
        MessageSid,
        AccountSid,
        From,
        To,
        Body,
        NumMedia,
        MediaUrl0,
        MediaContentType0,
        ProfileName,
        WaId,
        SmsStatus,
        MessageStatus,
      } = twilioData;

      this.logger.log(`Processing Twilio webhook - MessageSid: ${MessageSid}`);

      // Extract phone number from WhatsApp format (e.g., "whatsapp:+1234567890")
      const fromNumber = From?.replace('whatsapp:', '') || '';
      const toNumber = To?.replace('whatsapp:', '') || '';

      // Handle incoming message by adapting to Meta WhatsApp format
      if (Body || (NumMedia && parseInt(NumMedia) > 0)) {
        this.logger.log(`Incoming message from ${fromNumber}: ${Body || '[Media]'}`);

        // Adapt Twilio message format to Meta WhatsApp format
        const adaptedMessage: any = {
          from: fromNumber,
          id: MessageSid,
          timestamp: Math.floor(Date.now() / 1000).toString(),
          type: 'text',
        };

        // Handle text messages
        if (Body) {
          adaptedMessage.type = 'text';
          adaptedMessage.text = {
            body: Body,
          };
        }

        // Handle media messages
        if (NumMedia && parseInt(NumMedia) > 0 && MediaUrl0) {
          const mediaType = MediaContentType0?.startsWith('image/') ? 'image'
            : MediaContentType0?.startsWith('video/') ? 'video'
            : MediaContentType0?.startsWith('audio/') ? 'audio'
            : 'document';

          adaptedMessage.type = mediaType;
          adaptedMessage[mediaType] = {
            id: MessageSid,
            mime_type: MediaContentType0,
            link: MediaUrl0,
            caption: Body || '',
          };
        }

        // Adapt metadata (phone_number_id needs to be looked up from Twilio To number)
        const adaptedMetadata = {
          display_phone_number: toNumber,
          phone_number_id: toNumber, // Using To number as identifier
        };

        // Adapt contact info
        const adaptedContacts = [{
          wa_id: WaId || fromNumber,
          profile: {
            name: ProfileName || fromNumber,
          },
        }];

        // Reuse existing handleMessageWebhook method
        await this.whatsappService.handleMessageWebhook(
          adaptedMessage,
          adaptedMetadata,
          adaptedContacts,
        );
      }

      // Handle message status updates by adapting to Meta WhatsApp format
      if (SmsStatus || MessageStatus) {
        const status = SmsStatus || MessageStatus;
        this.logger.log(`Message status update: ${status}`);

        // Map Twilio status to Meta WhatsApp status
        const statusMap: Record<string, string> = {
          'queued': 'sent',
          'sending': 'sent',
          'sent': 'sent',
          'delivered': 'delivered',
          'read': 'read',
          'failed': 'failed',
          'undelivered': 'failed',
        };

        const adaptedStatus = {
          id: MessageSid,
          status: statusMap[status?.toLowerCase()] || 'sent',
          timestamp: Math.floor(Date.now() / 1000).toString(),
          recipient_id: toNumber,
          errors: status?.toLowerCase() === 'failed' || status?.toLowerCase() === 'undelivered'
            ? [{ message: 'Message delivery failed' }]
            : undefined,
        };

        // Reuse existing handleStatusWebhook method
        await this.whatsappService.handleStatusWebhook(adaptedStatus);
      }

    } catch (error) {
      this.logger.error('Error processing Twilio webhook:', error);
      this.logger.error('Webhook data:', JSON.stringify(twilioData, null, 2));
    }
  }
}
