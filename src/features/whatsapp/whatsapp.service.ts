import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppApiClientService } from './infrastructure/whatsapp-api-client.service';
import { TwilioClientService } from './infrastructure/twilio-client.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { KafkaConsumerService } from '../kafka/kafka-consumer.service';
import { ConversationStateService, OnboardingStep } from './services/conversation-state.service';
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
    private readonly twilioClient: TwilioClientService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly conversationState: ConversationStateService,
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
          is_active: true,
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
    console.log('Handling WhatsApp message webhook:', message, metadata, contacts);
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

      // commenting out mark as read for now
      // Mark as read
      // const accessToken = this.decryptToken(account.access_token);
      // await this.circuitBreaker.execute(
      //   `whatsapp-mark-read-${phoneNumberId}`,
      //   () => this.apiClient.markAsRead(phoneNumberId, accessToken, messageId),
      // );

      // Check conversation state for onboarding flow
      const state = await this.conversationState.getState(lead.lead_id);
      const storeName = account.businesses.business_name || 'our store';

      // If user is in onboarding, handle it specially
      if (state.step !== OnboardingStep.COMPLETED) {
        const onboardingResult = await this.conversationState.processResponse(
          lead.lead_id,
          messageText,
          storeName,
        );

        if (onboardingResult.nextMessage) {
          // Check if this is the completion message with buttons
          if (onboardingResult.completed && onboardingResult.buttons) {
            // Convert buttons to text-based menu since Twilio doesn't support interactive buttons
            const buttonOptions = onboardingResult.buttons
              .map((btn: any, index: number) => `${index + 1}️⃣ ${btn.reply.title}`)
              .join('\n');

            const messageWithOptions = `${onboardingResult.nextMessage}\n\nPlease reply with:\n${buttonOptions}`;

            await this.sendMessage(phoneNumberId, from, {
              messaging_product: 'whatsapp',
              to: from,
              type: SendMessageType.TEXT,
              text: { body: messageWithOptions, preview_url: false },
            });
          } else {
            await this.sendMessage(phoneNumberId, from, {
              messaging_product: 'whatsapp',
              to: from,
              type: SendMessageType.TEXT,
              text: { body: onboardingResult.nextMessage, preview_url: false },
            });
          }
        }

        if (!onboardingResult.completed) {
          return; // Don't send to AI yet, continue onboarding
        }

        // If onboarding just completed, don't send to AI (we already sent the menu)
        return;
      }

      // For returning users, greet them with their name and show menu
      if (lead.first_name && state.step === OnboardingStep.COMPLETED) {
        const userName = lead.first_name;

        // Check if user is responding to menu options
        const lowerMessage = messageText.toLowerCase().trim();
        const isMenuResponse =
          lowerMessage === '1' || lowerMessage.includes('browse') ||
          lowerMessage === '2' || lowerMessage.includes('track') ||
          lowerMessage === '3' || lowerMessage.includes('support');

        if (isMenuResponse) {
          // Handle menu option responses
          if (lowerMessage === '1' || lowerMessage.includes('browse')) {
            // Browse products option
            const productsMessage = `Great! 👌
You can explore our products below.

Tap the link to view the latest items 🛍️
https://example.com/products

_Note: Product catalog integration coming soon!_`;

            await this.sendMessage(phoneNumberId, from, {
              messaging_product: 'whatsapp',
              to: from,
              type: SendMessageType.TEXT,
              text: { body: productsMessage, preview_url: true },
            });
            return;
          } else if (lowerMessage === '2' || lowerMessage.includes('track')) {
            // Track order option
            const trackMessage = `Sure! 😊
To help you track your order, please share your Order ID.

Example: DB12345`;

            await this.sendMessage(phoneNumberId, from, {
              messaging_product: 'whatsapp',
              to: from,
              type: SendMessageType.TEXT,
              text: { body: trackMessage, preview_url: false },
            });
            return;
          } else if (lowerMessage === '3' || lowerMessage.includes('support')) {
            // Talk to support option
            const supportMessage = `💬 Connect with Support

Our support team is here to help! Please describe your issue and we'll get back to you shortly.

You can also call us at: +1 (555) 123-4567
Email: support@${storeName.toLowerCase().replace(/\s+/g, '')}.com`;

            await this.sendMessage(phoneNumberId, from, {
              messaging_product: 'whatsapp',
              to: from,
              type: SendMessageType.TEXT,
              text: { body: supportMessage, preview_url: false },
            });
            return;
          }
        }

        // Check if user is sending an order ID (e.g., DB12345, ORD123, etc.)
        const orderIdPattern = /^[A-Z]{2,4}\d{3,8}$/i;
        if (orderIdPattern.test(messageText.trim())) {
          const orderId = messageText.trim().toUpperCase();
          await this.handleOrderTracking(phoneNumberId, from, orderId, account.business_id);
          return;
        }

        // If not a menu response, show the menu
        const menuText = `Hello ${userName}! 👋
How can I assist you today?

Please reply with:
1️⃣ Browse products
2️⃣ Track order
3️⃣ Talk to support`;

        await this.sendMessage(phoneNumberId, from, {
          messaging_product: 'whatsapp',
          to: from,
          type: SendMessageType.TEXT,
          text: { body: menuText, preview_url: false },
        });
        return;
      }

      // Map business_type to AI service expected values
      const businessTypeMap: Record<string, string> = {
        'Retail': 'retail',
        'Beauty': 'service',
        'Restaurant': 'service',
        'Service': 'service',
        'D2C': 'd2c',
        'Education': 'education',
      };

      const mappedBusinessType = account.businesses.business_type
        ? businessTypeMap[account.businesses.business_type] || 'service'
        : 'service';

      // Get conversation history for context continuity
      const conversationHistory = await this.getConversationHistory(
        conversation.conversation_id,
        10, // Last 10 messages
      );

      // Send to AI processor via Kafka for NLU processing
      await this.kafkaProducer.requestAiProcessing({
        lead_id: lead.lead_id,
        business_id: account.business_id,
        text: messageText,
        business_type: mappedBusinessType,
        conversation_history: conversationHistory, // Include chat history for continuity
        context: {
          message_id: leadMessage.message_id,
          conversation_id: conversation.conversation_id,
          channel: 'whatsapp',
          contactName,
          phoneNumberId,
          from,
          business_name: account.businesses.business_name,
          lead_info: {
            lead_id: lead.lead_id,
            first_name: lead.first_name,
            last_name: lead.last_name,
            status: lead.status,
            lead_score: lead.lead_score,
          },
        },
        priority: 'normal',
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

      // Register handler for AI response
      this.kafkaConsumer.registerMessageHandler(lead.lead_id, {
        handleAiResponse: async (aiResult: any) => {
          await this.handleAiResponse(aiResult, leadMessage.message_id);
        },
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

      let result: any;
      let messageText: string;

      // Extract message text first
      messageText = this.extractMessageText(message);

      // Check if this is an interactive message (buttons/lists) and we have WhatsApp Business API token
      const hasWhatsAppApiToken = account.access_token && account.access_token.length > 50;
      const isInteractiveMessage = message.type === SendMessageType.INTERACTIVE;

      if (hasWhatsAppApiToken && isInteractiveMessage) {
        // Use official WhatsApp Business API for interactive messages (supports buttons)
        // const accessToken = this.decryptToken(account.access_token);

        // this.logger.log('Sending interactive message via WhatsApp Business API');
        // result = await this.circuitBreaker.execute(
        //   `whatsapp-send-${phoneNumberId}`,
        //   () => this.apiClient.sendMessage(phoneNumberId, accessToken, message),
        // );

        // TODO: WhatsApp Business API integration is not yet implemented
        // For now, fallback to Twilio with text-only version
        const formattedTo = to.startsWith('+') ? to : `+${to}`;
        this.logger.log('Sending interactive message as text via Twilio (WhatsApp API not configured)');
        result = await this.twilioClient.sendWhatsAppMessage(formattedTo, messageText);
      } else {
        // Use Twilio for simple text messages (Sandbox limitation)
        const formattedTo = to.startsWith('+') ? to : `+${to}`;

        this.logger.log('Sending text message via Twilio');
        result = await this.twilioClient.sendWhatsAppMessage(formattedTo, messageText);
      }

      // Find or get lead for this recipient
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: account.business_id,
          platform_user_id: to,
          source: 'whatsapp',
        },
      });

      // If lead exists and message was sent successfully, store the outbound message
      if (lead && result?.messageId) {
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
            message_text: messageText,
            message_type: message.type,
            platform_message_id: result.messageId, // Twilio message SID
            delivery_status: 'sent',
          },
        });
      }

      return {
        success: true,
        messages: result?.messageId ? [{
          id: result.messageId,
        }] : [],
        ...result,
      };
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Handle AI processing result from Kafka
   * Extracts intent and entities, then sends appropriate response
   */
  async handleAiResponse(aiResult: any, messageId: string): Promise<void> {
    try {
      const { intent, entities, suggested_response, suggested_actions } = aiResult;

      this.logger.log(`AI Response - Intent: ${intent?.intent}, Confidence: ${intent?.confidence}`);
      this.logger.log(`Entities extracted: ${JSON.stringify(entities)}`);
      this.logger.log(`Suggested actions: ${suggested_actions?.join(', ')}`);

      // Generate response - use AI suggestion or fallback to template
      let responseText = suggested_response;

      if (!responseText) {
        this.logger.log(`No suggested response from AI, using template for intent: ${intent?.intent}`);
        responseText = this.getTemplateResponse(intent?.intent, entities);
      }

      // Send the response back to the user
      if (responseText) {
        await this.sendAIResponse(messageId, responseText, suggested_actions);
      }

      // Log the AI processing activity
      await this.logAiProcessing(aiResult, messageId);

    } catch (error) {
      this.logger.error('Error handling AI response:', error);
    }
  }

  /**
   * Get template response based on intent when AI doesn't provide one
   */
  private getTemplateResponse(intentType: string, entities: any): string {
    // Check if entities are present (user provided details)
    const hasEntities = entities && Object.keys(entities).length > 0;

    if (hasEntities) {
      // User has provided details, acknowledge them
      return this.buildEntityAcknowledgment(intentType, entities);
    }

    // Default templates when no entities are extracted
    const templates: Record<string, string> = {
      ORDER_REQUEST:
        "Great! I'd be happy to help you with your order. Could you please share more details like size, color, or quantity?",
      PRICING_INQUIRY:
        "Thank you for your interest! Let me share our pricing information with you. What specific product are you interested in?",
      AVAILABILITY_INQUIRY:
        "Let me check the availability for you. Could you please specify which product you're looking for?",
      COMPLAINT:
        "I'm sorry to hear about your concern. We take this seriously and our support team will assist you right away. Could you please provide more details?",
      SCHEDULE_CALL:
        "I'd be happy to schedule a call for you. What time works best for you?",
      GREETING:
        "Hello! Welcome! How can I assist you today?",
      GENERAL_INQUIRY:
        "Thank you for reaching out! I'm here to help. Could you please provide more details about what you're looking for?",
    };

    return templates[intentType] ||
      "Thank you for your message! Our team will get back to you shortly with the information you need.";
  }

  /**
   * Build response that acknowledges extracted entities
   */
  private buildEntityAcknowledgment(intentType: string, entities: any): string {
    let response = "Thank you for providing those details! ";

    // Build entity summary
    const entitySummary: string[] = [];
    if (entities.size) entitySummary.push(`Size: ${entities.size}`);
    if (entities.color) entitySummary.push(`Color: ${entities.color}`);
    if (entities.quantity) entitySummary.push(`Quantity: ${entities.quantity}`);
    if (entities.product) entitySummary.push(`Product: ${entities.product}`);

    if (entitySummary.length > 0) {
      response += "I've noted:\n" + entitySummary.join("\n") + "\n\n";
    }

    // Add intent-specific follow-up
    switch (intentType) {
      case 'ORDER_REQUEST':
        response += "Let me check our inventory and prepare your order. I'll get back to you shortly with availability and pricing details.";
        break;
      case 'PRICING_INQUIRY':
        response += "Let me get you the pricing information for these specifications.";
        break;
      case 'AVAILABILITY_INQUIRY':
        response += "Let me check if we have this in stock for you.";
        break;
      default:
        response += "Our team will process this information and get back to you shortly.";
    }

    return response;
  }

  /**
   * Get conversation history for context continuity
   * Retrieves the last N messages from the conversation
   */
  private async getConversationHistory(
    conversationId: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      const messages = await this.prisma.lead_messages.findMany({
        where: {
          conversation_id: conversationId,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
        select: {
          message_id: true,
          sender_type: true,
          sender_name: true,
          message_text: true,
          message_type: true,
          created_at: true,
        },
      });

      // Reverse to get chronological order (oldest first)
      return messages.reverse().map((msg) => ({
        role: msg.sender_type === 'lead' ? 'user' : 'assistant',
        content: msg.message_text,
        timestamp: msg.created_at,
        message_type: msg.message_type,
      }));
    } catch (error) {
      this.logger.error('Failed to get conversation history:', error);
      return []; // Return empty array if history retrieval fails
    }
  }

  /**
   * Log AI processing results to lead activities
   */
  private async logAiProcessing(aiResult: any, messageId: string): Promise<void> {
    try {
      const context = this.pendingMessages.get(messageId);
      if (!context) return;

      const lead = await this.prisma.leads.findUnique({
        where: { lead_id: aiResult.lead_id },
        select: { tenant_id: true },
      });

      if (!lead?.tenant_id) return;

      await this.prisma.lead_activities.create({
        data: {
          lead_id: aiResult.lead_id,
          business_id: context.businessId,
          tenant_id: lead.tenant_id,
          activity_type: 'ai_processed',
          activity_description: `AI detected intent: ${aiResult.intent?.intent} (confidence: ${aiResult.intent?.confidence})`,
          actor_type: 'system',
          channel: 'ai',
          metadata: {
            processing_id: aiResult.processing_id,
            intent: aiResult.intent,
            entities: aiResult.entities,
            suggested_actions: aiResult.suggested_actions,
            processing_time_ms: aiResult.processing_time_ms,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log AI processing:', error);
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
    try {
      const algorithm = 'aes-256-cbc';
      const encryptionKey = this.configService.get<string>('encryption.key');

      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured. Please set ENCRYPTION_KEY in your .env file.');
      }

      const key = Buffer.from(encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Failed to encrypt token:', error);
      throw new BadRequestException('Token encryption failed. Please check server configuration.');
    }
  }

  /**
   * Decrypt access token
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const encryptionKey = this.configService.get<string>('encryption.key');

      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured. Please set ENCRYPTION_KEY in your .env file.');
      }

      if (!encryptedToken || !encryptedToken.includes(':')) {
        throw new Error('Invalid encrypted token format');
      }

      const key = Buffer.from(encryptionKey, 'hex');
      const parts = encryptedToken.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt token:', error);
      throw new BadRequestException('Token decryption failed. The stored token may be corrupted or the encryption key has changed.');
    }
  }

  /**
   * Handle order tracking when user sends an order ID
   */
  private async handleOrderTracking(
    phoneNumberId: string,
    to: string,
    orderId: string,
    _businessId: string, // Will be used for database lookup when order system is integrated
  ): Promise<void> {
    try {
      // TODO: Replace with actual database lookup when order system is integrated
      // TODO: Use businessId to query orders table: await this.prisma.orders.findFirst({ where: { order_id: orderId, business_id: businessId }})
      // For now, return mock data
      const mockOrderStatuses = [
        { status: 'Processing', delivery: 'Tomorrow, 3:00 PM - 5:00 PM' },
        { status: 'Shipped', delivery: 'Today, 6:00 PM - 8:00 PM' },
        { status: 'Out for Delivery', delivery: 'Today, by 5:00 PM' },
        { status: 'Delivered', delivery: 'Already delivered on Dec 1, 2025' },
      ];

      // Simulate order lookup with random status
      const randomStatus = mockOrderStatuses[Math.floor(Math.random() * mockOrderStatuses.length)];

      const trackingMessage = `Here's the latest update for Order ${orderId} 📦

Status: ${randomStatus.status}
Estimated Delivery: ${randomStatus.delivery}

Tap the link below to view more details 👇
https://example.com/track/${orderId}

_Note: Order tracking integration coming soon!_`;

      await this.sendMessage(phoneNumberId, to, {
        messaging_product: 'whatsapp',
        to,
        type: SendMessageType.TEXT,
        text: { body: trackingMessage, preview_url: true },
      });

      this.logger.log(`Order tracking info sent for ${orderId}`);
    } catch (error) {
      this.logger.error('Failed to handle order tracking:', error);

      // Send error message to user
      await this.sendMessage(phoneNumberId, to, {
        messaging_product: 'whatsapp',
        to,
        type: SendMessageType.TEXT,
        text: {
          body: `Sorry, I couldn't find order ${orderId}. Please check the Order ID and try again.`,
          preview_url: false,
        },
      });
    }
  }

  /**
   * Close a conversation
   * Useful for ending long conversations and starting fresh context
   */
  async closeConversation(conversationId: string): Promise<void> {
    try {
      await this.prisma.lead_conversations.update({
        where: { conversation_id: conversationId },
        data: {
          status: 'closed',
          is_resolved: true,
        },
      });

      this.logger.log(`Conversation ${conversationId} closed`);
    } catch (error) {
      this.logger.error('Failed to close conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation summary statistics
   */
  async getConversationStats(conversationId: string): Promise<any> {
    try {
      const [conversation, messageCount, firstMessage, lastMessage] = await Promise.all([
        this.prisma.lead_conversations.findUnique({
          where: { conversation_id: conversationId },
          include: { leads: true },
        }),
        this.prisma.lead_messages.count({
          where: { conversation_id: conversationId },
        }),
        this.prisma.lead_messages.findFirst({
          where: { conversation_id: conversationId },
          orderBy: { created_at: 'asc' },
        }),
        this.prisma.lead_messages.findFirst({
          where: { conversation_id: conversationId },
          orderBy: { created_at: 'desc' },
        }),
      ]);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const duration = firstMessage && lastMessage
        ? new Date(lastMessage.created_at).getTime() - new Date(firstMessage.created_at).getTime()
        : 0;

      return {
        conversation_id: conversationId,
        lead_name: `${conversation.leads.first_name || ''} ${conversation.leads.last_name || ''}`.trim(),
        channel: conversation.channel,
        status: conversation.status,
        is_resolved: conversation.is_resolved,
        message_count: messageCount,
        started_at: conversation.started_at,
        last_message_at: lastMessage?.created_at,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000),
      };
    } catch (error) {
      this.logger.error('Failed to get conversation stats:', error);
      throw error;
    }
  }
}
