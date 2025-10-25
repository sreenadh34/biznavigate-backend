// Example: How to integrate Kafka in your Lead Service

import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Example Lead Service Integration with Kafka
 * 
 * Add this to your existing LeadService
 */
@Injectable()
export class LeadServiceKafkaIntegration {
  private readonly logger = new Logger(LeadServiceKafkaIntegration.name);

  constructor(
    private readonly kafkaProducer: KafkaProducerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Example 1: Create Lead with Kafka Event
   */
  async createLeadWithAI(createLeadDto: any) {
    // 1. Create lead in database
    const lead = await this.prisma.leads.create({
      data: {
        first_name: createLeadDto.first_name,
        last_name: createLeadDto.last_name,
        phone: createLeadDto.phone,
        email: createLeadDto.email,
        source: createLeadDto.source,
        business_id: createLeadDto.business_id,
        tenant_id: createLeadDto.tenant_id,
        platform_user_id: createLeadDto.platform_user_id,
        // ... other fields
      },
    });

    this.logger.log(`Lead created: ${lead.lead_id}`);

    // 2. Publish Kafka event for AI processing (non-blocking)
    try {
      await this.kafkaProducer.publishLeadCreated({
        lead_id: lead.lead_id,
        business_id: lead.business_id,
        tenant_id: lead.tenant_id,
        source: lead.source,
        platform_user_id: lead.platform_user_id,
        initial_message: createLeadDto.initial_message,
        phone: lead.phone,
        email: lead.email,
        metadata: {
          business_type: createLeadDto.business_type,
        },
      });

      this.logger.log(`Kafka event published for lead: ${lead.lead_id}`);
    } catch (error) {
      // Log error but don't fail lead creation
      this.logger.error(`Failed to publish Kafka event: ${error.message}`);
    }

    return lead;
  }

  /**
   * Example 2: Handle New Message with Kafka Event
   */
  async handleInboundMessage(messageDto: any) {
    // 1. Save message to database
    const message = await this.prisma.lead_messages.create({
      data: {
        conversation_id: messageDto.conversation_id,
        lead_id: messageDto.lead_id,
        business_id: messageDto.business_id,
        tenant_id: messageDto.tenant_id,
        sender_type: 'lead', // 'inbound' equivalent
        message_text: messageDto.message_text,
        // ... other fields
      },
    });

    // 2. Update lead's last activity
    await this.prisma.leads.update({
      where: { lead_id: messageDto.lead_id },
      data: {
        last_activity_at: new Date(),
        last_contact_at: new Date(),
      },
    });

    // 3. Publish to Kafka for AI processing
    try {
      const lead = await this.prisma.leads.findUnique({
        where: { lead_id: messageDto.lead_id },
        include: { businesses: true },
      });

      await this.kafkaProducer.publishLeadMessage({
        lead_id: messageDto.lead_id,
        business_id: lead.business_id,
        message_id: message.message_id,
        message_text: messageDto.message_text,
        direction: 'inbound',
        channel: messageDto.channel,
        metadata: {
          business_type: lead.businesses.business_type,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to publish message event: ${error.message}`);
    }

    return message;
  }

  /**
   * Example 3: Explicit AI Processing Request
   */
  async requestAiAnalysis(leadId: string) {
    const lead = await this.prisma.leads.findUnique({
      where: { lead_id: leadId },
      include: {
        businesses: true,
        lead_messages: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Combine recent messages for context
    const recentMessages = lead.lead_messages
      .map((m) => m.message_text)
      .join('\n');

    // Request AI processing with high priority
    await this.kafkaProducer.requestAiProcessing({
      lead_id: lead.lead_id,
      business_id: lead.business_id,
      text: recentMessages,
      business_type: lead.businesses.business_type,
      priority: 'high',
      context: {
        lead_source: lead.source,
        conversation_count: lead.lead_messages.length,
      },
    });

    return {
      message: 'AI analysis requested',
      lead_id: leadId,
    };
  }
}

/**
 * HOW TO USE IN YOUR EXISTING LEAD SERVICE:
 * 
 * 1. Add KafkaProducerService to your LeadService constructor:
 * 
 * constructor(
 *   private readonly prisma: PrismaService,
 *   private readonly kafkaProducer: KafkaProducerService,  // Add this
 *   // ... other dependencies
 * ) {}
 * 
 * 2. In your create() method, add:
 * 
 * async create(createLeadDto: CreateLeadDto, tenantId: string) {
 *   // ... existing code to create lead ...
 *   
 *   // Publish to Kafka for AI processing
 *   await this.kafkaProducer.publishLeadCreated({
 *     lead_id: lead.lead_id,
 *     business_id: lead.business_id,
 *     tenant_id: tenantId,
 *     source: lead.source,
 *     initial_message: createLeadDto.initial_message,
 *   }).catch(err => this.logger.error('Kafka publish failed', err));
 *   
 *   return lead;
 * }
 * 
 * 3. Don't forget to import KafkaModule in LeadModule!
 */
