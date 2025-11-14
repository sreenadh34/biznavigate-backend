import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { SendWidgetMessageDto, UpdateVisitorInfoDto } from './dto/widget-message.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatWidgetService {
  private readonly logger = new Logger(ChatWidgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  /**
   * Initialize widget session and get conversation history
   */
  async initWidget(businessId: string, visitorId: string, pageUrl?: string): Promise<any> {
    try {
      // Verify business exists
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Find existing lead by visitor ID
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: businessId,
          platform_user_id: visitorId,
          source: 'website_chat',
        },
      });

      // Find active conversation
      let conversation = null;
      let messages = [];

      if (lead) {
        conversation = await this.prisma.lead_conversations.findFirst({
          where: {
            lead_id: lead.lead_id,
            channel: 'website_chat',
            status: 'active',
          },
          include: {
            lead_messages: {
              orderBy: { timestamp: 'asc' },
              take: 50, // Last 50 messages
            },
          },
        });

        if (conversation) {
          messages = conversation.lead_messages.map(msg => ({
            id: msg.message_id,
            text: msg.message_text,
            sender: msg.sender_type,
            timestamp: msg.timestamp,
            senderName: msg.sender_name,
          }));
        }
      }

      return {
        visitorId,
        leadId: lead?.lead_id,
        conversationId: conversation?.conversation_id,
        messages,
        config: {
          welcomeMessage: business.business_name
            ? `Hi! Welcome to ${business.business_name}. How can we help you today?`
            : 'Hi! How can we help you today?',
          botName: business.business_name || 'Support Bot',
        },
      };
    } catch (error) {
      this.logger.error('Error initializing widget:', error);
      throw error;
    }
  }

  /**
   * Process incoming widget message
   */
  async processMessage(data: SendWidgetMessageDto): Promise<any> {
    try {
      const { businessId, message, visitorId, visitorName, visitorEmail, visitorPhone, pageUrl, pageTitle, metadata } = data;

      // Verify business exists
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Find or create lead
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: businessId,
          platform_user_id: visitorId,
          source: 'website_chat',
        },
      });

      if (!lead) {
        // Create new lead
        const nameParts = visitorName ? visitorName.split(' ') : ['Anonymous'];
        lead = await this.prisma.leads.create({
          data: {
            business_id: businessId,
            tenant_id: business.tenant_id,
            source: 'website_chat',
            platform_user_id: visitorId,
            first_name: nameParts[0] || 'Anonymous',
            last_name: nameParts.slice(1).join(' ') || null,
            email: visitorEmail || null,
            phone: visitorPhone || null,
            status: 'new',
            lead_score: 5,
            // Store page info in notes or custom field if needed
          },
        });

        this.logger.log(`Created new lead from website chat: ${lead.lead_id}`);
      } else if (visitorEmail || visitorPhone || visitorName) {
        // Update lead with new information
        const updateData: any = {};
        if (visitorEmail && !lead.email) updateData.email = visitorEmail;
        if (visitorPhone && !lead.phone) updateData.phone = visitorPhone;
        if (visitorName) {
          const nameParts = visitorName.split(' ');
          updateData.first_name = nameParts[0];
          updateData.last_name = nameParts.slice(1).join(' ') || null;
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.leads.update({
            where: { lead_id: lead.lead_id },
            data: updateData,
          });
        }
      }

      // Find or create conversation
      let conversation = await this.prisma.lead_conversations.findFirst({
        where: {
          lead_id: lead.lead_id,
          channel: 'website_chat',
          status: 'active',
        },
      });

      if (!conversation) {
        conversation = await this.prisma.lead_conversations.create({
          data: {
            lead_id: lead.lead_id,
            business_id: businessId,
            tenant_id: business.tenant_id,
            channel: 'website_chat',
            status: 'active',
            started_at: new Date(),
          },
        });

        this.logger.log(`Created new conversation: ${conversation.conversation_id}`);
      }

      // Store visitor message
      const visitorMessage = await this.prisma.lead_messages.create({
        data: {
          conversation_id: conversation.conversation_id,
          lead_id: lead.lead_id,
          business_id: businessId,
          tenant_id: business.tenant_id,
          sender_type: 'lead',
          sender_name: visitorName || 'Visitor',
          message_text: message,
          message_type: 'text',
          delivery_status: 'received',
          metadata: {
            pageUrl,
            pageTitle,
            ...metadata,
          },
        },
      });

      this.logger.log(`Stored widget message: ${visitorMessage.message_id}`);

      // Send to AI processor via Kafka
      await this.kafkaProducer.publishLeadMessage({
        lead_id: lead.lead_id,
        business_id: businessId,
        message_id: visitorMessage.message_id,
        message_text: message,
        direction: 'inbound',
        channel: 'website_chat',
        metadata: {
          visitorId,
          visitorName,
          pageUrl,
          pageTitle,
          conversationId: conversation.conversation_id,
        },
      });

      this.logger.log(`Sent message to AI processor: ${visitorMessage.message_id}`);

      return {
        messageId: visitorMessage.message_id,
        conversationId: conversation.conversation_id,
        leadId: lead.lead_id,
        timestamp: visitorMessage.timestamp,
      };
    } catch (error) {
      this.logger.error('Error processing widget message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(businessId: string, visitorId: string): Promise<any[]> {
    try {
      const lead = await this.prisma.leads.findFirst({
        where: {
          business_id: businessId,
          platform_user_id: visitorId,
          source: 'website_chat',
        },
      });

      if (!lead) {
        return [];
      }

      const conversation = await this.prisma.lead_conversations.findFirst({
        where: {
          lead_id: lead.lead_id,
          channel: 'website_chat',
          status: 'active',
        },
        include: {
          lead_messages: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!conversation) {
        return [];
      }

      return conversation.lead_messages.map(msg => ({
        id: msg.message_id,
        text: msg.message_text,
        sender: msg.sender_type,
        timestamp: msg.timestamp,
        senderName: msg.sender_name,
      }));
    } catch (error) {
      this.logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Update visitor information
   */
  async updateVisitorInfo(data: UpdateVisitorInfoDto): Promise<void> {
    try {
      const { businessId, visitorId, name, email, phone } = data;

      const lead = await this.prisma.leads.findFirst({
        where: {
          business_id: businessId,
          platform_user_id: visitorId,
          source: 'website_chat',
        },
      });

      if (!lead) {
        this.logger.warn(`Lead not found for visitor: ${visitorId}`);
        return;
      }

      const updateData: any = {};
      if (name) {
        const nameParts = name.split(' ');
        updateData.first_name = nameParts[0];
        updateData.last_name = nameParts.slice(1).join(' ') || null;
      }
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.leads.update({
          where: { lead_id: lead.lead_id },
          data: updateData,
        });

        this.logger.log(`Updated visitor info for lead: ${lead.lead_id}`);
      }
    } catch (error) {
      this.logger.error('Error updating visitor info:', error);
    }
  }

  /**
   * Send bot response (called by AI processor)
   */
  async sendBotResponse(conversationId: string, message: string): Promise<any> {
    try {
      const conversation = await this.prisma.lead_conversations.findUnique({
        where: { conversation_id: conversationId },
        include: {
          leads: true,
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const botMessage = await this.prisma.lead_messages.create({
        data: {
          conversation_id: conversationId,
          lead_id: conversation.lead_id,
          business_id: conversation.business_id,
          tenant_id: conversation.tenant_id,
          sender_type: 'business',
          sender_name: 'Support Bot',
          message_text: message,
          message_type: 'text',
          delivery_status: 'sent',
          is_automated: true,
        },
      });

      this.logger.log(`Sent bot response: ${botMessage.message_id}`);

      return {
        messageId: botMessage.message_id,
        text: message,
        timestamp: botMessage.timestamp,
      };
    } catch (error) {
      this.logger.error('Error sending bot response:', error);
      throw error;
    }
  }

  /**
   * Get widget configuration for business
   */
  async getWidgetConfig(businessId: string): Promise<any> {
    try {
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Extract primary color from brand_colors if available
      let primaryColor = '#0084FF';
      if (business.brand_colors && typeof business.brand_colors === 'object') {
        const brandColors = business.brand_colors as any;
        primaryColor = brandColors.primary || brandColors.primaryColor || '#0084FF';
      }

      return {
        businessId,
        primaryColor: primaryColor,
        welcomeMessage: `Hi! Welcome to ${business.business_name}. How can we help you today?`,
        botName: business.business_name || 'Support Bot',
        position: 'bottom-right',
        showBranding: true,
      };
    } catch (error) {
      this.logger.error('Error getting widget config:', error);
      throw error;
    }
  }
}
