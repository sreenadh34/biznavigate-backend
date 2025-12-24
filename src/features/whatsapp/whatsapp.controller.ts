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
   * Process webhook events (Meta WhatsApp)
   */
  private async processWebhook(webhookData: WhatsAppWebhookDto): Promise<void> {    
    try {
      for (const entry of webhookData.entry) {
        const changes = this.webhookValidator.extractChanges(entry);

        console.log("changes", changes);

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

}
