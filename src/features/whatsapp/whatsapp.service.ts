import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppApiClientService } from './infrastructure/whatsapp-api-client.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { SendWhatsAppMessageDto, SendMessageType, TextDto, InteractiveSendType } from './dto/whatsapp-message.dto';
import * as crypto from 'crypto';

interface PendingContext {
  messageId: string;
  conversationId: string;
  from: string;
  to: string;
  businessId: string;
  tenantId: string;
  type: 'text' | 'interactive' | 'media';
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly pendingMessages = new Map<string, PendingContext>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: WhatsAppApiClientService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Connect WhatsApp account to business
   */
  async connectWhatsAppAccount(
    whatsappBusinessAccountId: string,
    phoneNumberId: string,
    accessToken: string,
    businessId: string,
  ): Promise<any> {
    try {
      // Get business and tenant info
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Get phone number details from WhatsApp API
      const phoneDetails = await this.circuitBreaker.execute(
        `whatsapp-phone-details-${phoneNumberId}`,
        () => this.apiClient.getPhoneNumberDetails(phoneNumberId, accessToken),
      );

      // Calculate token expiry (long-lived tokens last 60 days)
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 60);

      // Save to database (using page_id for phone_number_id since it's not in schema)
      const account = await this.prisma.social_accounts.create({
        data: {
          business_id: businessId,
          platform: 'whatsapp',
          platform_user_id: phoneDetails.id,
          username: phoneDetails.display_phone_number,
          page_id: phoneNumberId, // Store phone number ID here
          access_token: this.encryptToken(accessToken),
          token_expiry: tokenExpiry,
          instagram_business_account_id: whatsappBusinessAccountId, // Reuse for WhatsApp Business Account ID
          account_type: 'business',
          is_active: true,
          last_synced_at: new Date(),
        },
      });

      this.logger.log(`WhatsApp account ${phoneDetails.display_phone_number} connected for business ${businessId}`);

      return {
        accountId: account.account_id,
        phoneNumber: phoneDetails.display_phone_number,
        verifiedName: phoneDetails.verified_name,
        qualityRating: phoneDetails.quality_rating,
      };
    } catch (error) {
      this.logger.error('Failed to connect WhatsApp account:', error);
      throw error;
    }
  }

  /**
   * Get all WhatsApp accounts for a business
   */
  async getWhatsAppAccounts(businessId: string): Promise<any[]> {
    const accounts = await this.prisma.social_accounts.findMany({
      where: {
        business_id: businessId,
        platform: 'whatsapp',
        is_active: true,
      },
      select: {
        account_id: true,
        username: true,
        page_id: true, // This stores phone_number_id
        instagram_business_account_id: true, // This stores whatsapp_business_account_id
        is_active: true,
        created_at: true,
        last_synced_at: true,
      },
    });

    return accounts.map(acc => ({
      ...acc,
      phone_number_id: acc.page_id,
      whatsapp_business_account_id: acc.instagram_business_account_id,
    }));
  }

  /**
   * Disconnect WhatsApp account
   */
  async disconnectAccount(accountId: string, businessId: string): Promise<void> {
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        account_id: accountId,
        business_id: businessId,
        platform: 'whatsapp',
      },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found');
    }

    await this.prisma.social_accounts.update({
      where: { account_id: accountId },
      data: { is_active: false },
    });

    this.logger.log(`WhatsApp account ${accountId} disconnected`);
  }

  /**
   * Handle incoming message webhook
   */
  async handleMessageWebhook(message: any, metadata: any, contacts: any[]): Promise<void> {
    try {
      const phoneNumberId = metadata.phone_number_id;
      const from = message.from;
      const messageId = message.id;
      const timestamp = parseInt(message.timestamp) * 1000; // Convert to milliseconds

      this.logger.log(`📱 WhatsApp message received from ${from}`);

      // Find business by phone number ID (stored in page_id field)
      const account = await this.prisma.social_accounts.findFirst({
        where: {
          platform: 'whatsapp',
          page_id: phoneNumberId, // phone_number_id is stored in page_id field
          is_active: true,
        },
        include: {
          businesses: true,
        },
      });

      if (!account) {
        this.logger.warn(`No active WhatsApp account found for phone number ID: ${phoneNumberId}`);
        return;
      }

      // Extract contact info
      const contact = contacts?.find(c => c.wa_id === from);
      const contactName = contact?.profile?.name || from;

      // Create or find existing lead
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: account.business_id,
          platform_user_id: from,
          source: 'whatsapp',
        },
      });

      if (!lead) {
        const nameParts = contactName.split(' ');
        lead = await this.prisma.leads.create({
          data: {
            business_id: account.business_id,
            tenant_id: account.businesses.tenant_id,
            source: 'whatsapp',
            platform_user_id: from,
            first_name: nameParts[0] || contactName,
            last_name: nameParts.slice(1).join(' ') || null,
            phone: from,
            status: 'new',
            lead_score: 5,
          },
        });

        this.logger.log(`New lead created from WhatsApp: ${lead.lead_id}`);
      }

      // Extract message content
      let messageText = '';
      let messageType = message.type;
      let mediaData: any = null;

      switch (message.type) {
        case 'text':
          messageText = message.text?.body || '';
          break;
        case 'image':
        case 'video':
        case 'audio':
        case 'document':
          mediaData = message[message.type];
          messageText = mediaData?.caption || `[${message.type}]`;
          break;
        case 'location':
          messageText = `Location: ${message.location?.latitude}, ${message.location?.longitude}`;
          break;
        case 'interactive':
          if (message.interactive?.type === 'button_reply') {
            messageText = message.interactive.button_reply?.title || '';
          } else if (message.interactive?.type === 'list_reply') {
            messageText = message.interactive.list_reply?.title || '';
          }
          break;
        case 'reaction':
          messageText = `Reacted with ${message.reaction?.emoji || 'removed reaction'}`;
          break;
        default:
          messageText = `[Unsupported message type: ${message.type}]`;
      }

      // Find or create conversation
      let conversation = await this.prisma.lead_conversations.findFirst({
        where: {
          lead_id: lead.lead_id,
          channel: 'whatsapp',
          status: 'active',
        },
      });

      if (!conversation) {
        conversation = await this.prisma.lead_conversations.create({
          data: {
            lead_id: lead.lead_id,
            business_id: account.business_id,
            tenant_id: account.businesses.tenant_id,
            channel: 'whatsapp',
            status: 'active',
            started_at: new Date(),
          },
        });
      }

      // Store message in database using lead_messages
      const leadMessage = await this.prisma.lead_messages.create({
        data: {
          conversation_id: conversation.conversation_id,
          lead_id: lead.lead_id,
          business_id: account.business_id,
          tenant_id: account.businesses.tenant_id,
          sender_type: 'lead',
          sender_name: contactName,
          message_text: messageText,
          message_type: messageType,
          platform_message_id: messageId,
          delivery_status: 'received',
        },
      });

      // Mark as read
      const accessToken = this.decryptToken(account.access_token);
      await this.circuitBreaker.execute(
        `whatsapp-mark-read-${phoneNumberId}`,
        () => this.apiClient.markAsRead(phoneNumberId, accessToken, messageId),
      );

      // Send to AI processor via Kafka
      await this.kafkaProducer.publishLeadMessage({
        lead_id: lead.lead_id,
        business_id: account.business_id,
        message_id: leadMessage.message_id,
        message_text: messageText,
        direction: 'inbound',
        channel: 'whatsapp',
        metadata: {
          contactName,
          mediaData,
          phoneNumberId,
          from,
        },
      });

      // Store pending context for AI response
      this.pendingMessages.set(leadMessage.message_id, {
        messageId: leadMessage.message_id,
        conversationId: conversation.conversation_id,
        from: phoneNumberId,
        to: from,
        businessId: account.business_id,
        tenantId: account.businesses.tenant_id,
        type: messageType,
      });

      // Auto-cleanup after 10 minutes
      setTimeout(() => {
        this.pendingMessages.delete(leadMessage.message_id);
      }, 600000);

    } catch (error) {
      this.logger.error('Error processing WhatsApp message webhook:', error);
    }
  }

  /**
   * Handle status update webhook (sent, delivered, read, failed)
   */
  async handleStatusWebhook(status: any): Promise<void> {
    try {
      const messageId = status.id;
      const statusType = status.status;
      const recipientId = status.recipient_id;

      this.logger.log(`📊 Message ${messageId} status: ${statusType}`);

      // Map WhatsApp status to our delivery_status
      const deliveryStatusMap: Record<string, string> = {
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
      };

      const timestamp = new Date(parseInt(status.timestamp) * 1000);

      // Build update data based on status
      const updateData: any = {
        delivery_status: deliveryStatusMap[statusType] || statusType,
      };

      if (statusType === 'delivered') {
        updateData.delivered_at = timestamp;
      } else if (statusType === 'read') {
        updateData.read_at = timestamp;
      } else if (statusType === 'failed') {
        updateData.failed_reason = status.errors?.[0]?.message || 'Unknown error';
      }

      // Update message status in database
      await this.prisma.lead_messages.updateMany({
        where: {
          platform_message_id: messageId,
        },
        data: updateData,
      });

      // Handle errors if any
      if (status.errors && status.errors.length > 0) {
        this.logger.error(`Message ${messageId} failed:`, status.errors);
      }

    } catch (error) {
      this.logger.error('Error processing status webhook:', error);
    }
  }

  /**
   * Send message via WhatsApp
   */
  async sendMessage(
    phoneNumberId: string,
    to: string,
    message: SendWhatsAppMessageDto,
  ): Promise<any> {
    try {
      // Get account and access token
      const account = await this.prisma.social_accounts.findFirst({
        where: {
          page_id: phoneNumberId, // phone_number_id is stored in page_id
          platform: 'whatsapp',
          is_active: true,
        },
        include: {
          businesses: true,
        },
      });

      if (!account) {
        throw new NotFoundException('WhatsApp account not found');
      }

      const accessToken = this.decryptToken(account.access_token);

      // Send message
      const result = await this.circuitBreaker.execute(
        `whatsapp-send-${phoneNumberId}`,
        () => this.apiClient.sendMessage(phoneNumberId, accessToken, message),
      );

      // Find or get lead for this recipient
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: account.business_id,
          platform_user_id: to,
          source: 'whatsapp',
        },
      });

      // If lead exists, store the outbound message
      if (lead) {
        // Find or create conversation
        let conversation = await this.prisma.lead_conversations.findFirst({
          where: {
            lead_id: lead.lead_id,
            channel: 'whatsapp',
            status: 'active',
          },
        });

        if (!conversation) {
          conversation = await this.prisma.lead_conversations.create({
            data: {
              lead_id: lead.lead_id,
              business_id: account.business_id,
              tenant_id: account.businesses.tenant_id,
              channel: 'whatsapp',
              status: 'active',
              started_at: new Date(),
            },
          });
        }

        // Store message in lead_messages
        await this.prisma.lead_messages.create({
          data: {
            conversation_id: conversation.conversation_id,
            lead_id: lead.lead_id,
            business_id: account.business_id,
            tenant_id: account.businesses.tenant_id,
            sender_type: 'business',
            message_text: this.extractMessageText(message),
            message_type: message.type,
            platform_message_id: result.messages[0].id,
            delivery_status: 'sent',
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send AI-generated response
   */
  async sendAIResponse(messageId: string, responseText: string, actions?: any[]): Promise<void> {
    const context = this.pendingMessages.get(messageId);
    if (!context) {
      this.logger.warn(`No pending context found for message ${messageId}`);
      return;
    }

    try {
      const message: SendWhatsAppMessageDto = {
        messaging_product: 'whatsapp',
        to: context.to,
        type: SendMessageType.TEXT,
        text: {
          body: responseText,
          preview_url: true,
        },
      };

      await this.sendMessage(context.from, context.to, message);

      // Clean up pending context
      this.pendingMessages.delete(messageId);

    } catch (error) {
      this.logger.error('Failed to send AI response:', error);
    }
  }

  /**
   * Send interactive button message
   */
  async sendButtonMessage(
    phoneNumberId: string,
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    headerText?: string,
    footerText?: string,
  ): Promise<any> {
    const message: SendWhatsAppMessageDto = {
      messaging_product: 'whatsapp',
      to,
      type: SendMessageType.INTERACTIVE,
      interactive: {
        type: InteractiveSendType.BUTTON,
        body: { text: bodyText },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: btn,
          })),
        },
      },
    };

    if (headerText) {
      message.interactive!.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      message.interactive!.footer = { text: footerText };
    }

    return this.sendMessage(phoneNumberId, to, message);
  }

  /**
   * Send list message
   */
  async sendListMessage(
    phoneNumberId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
    headerText?: string,
    footerText?: string,
  ): Promise<any> {
    const message: SendWhatsAppMessageDto = {
      messaging_product: 'whatsapp',
      to,
      type: SendMessageType.INTERACTIVE,
      interactive: {
        type: InteractiveSendType.LIST,
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections,
        },
      },
    };

    if (headerText) {
      message.interactive!.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      message.interactive!.footer = { text: footerText };
    }

    return this.sendMessage(phoneNumberId, to, message);
  }


  /**
   * Extract message text from send message DTO
   */
  private extractMessageText(message: SendWhatsAppMessageDto): string {
    if (message.text) {
      return message.text.body;
    }
    if (message.template) {
      return `Template: ${message.template.name}`;
    }
    if (message.interactive) {
      return message.interactive.body.text;
    }
    return `[${message.type}]`;
  }

  /**
   * Encrypt access token
   */
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(
      this.configService.get<string>('encryption.key'),
      'hex'
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt access token
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(
      this.configService.get<string>('encryption.key'),
      'hex'
    );
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
