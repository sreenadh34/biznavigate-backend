import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SendMessageDto } from "./dto/send-message.dto";
import { KafkaProducerService } from "src/features/kafka/kafka-producer.service";
import { KafkaConsumerService } from "src/features/kafka/kafka-consumer.service";
import { WhatsAppMessageHandlerService } from "./whatsapp-message-handler.service";
import { PrismaService } from "src/prisma/prisma.service";

export interface MessageResponse {
  success: boolean;
  messageId: string;
  timestamp: string;
  to: string;
  message: string;
  status: string;
  leadId?: string;
}

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private messageCounter = 0;
  private pendingMessages: Map<
    string,
    {
      from: string;
      to: string;
      originalMessage: string;
      businessId: string;
      tenantId: string;
    }
  > = new Map();

  constructor(
    private readonly kafkaProducer: KafkaProducerService,
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly messageHandler: WhatsAppMessageHandlerService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.logger.log("WhatsApp Service initialized");
  }

  async sendMessage(dto: SendMessageDto): Promise<MessageResponse> {
    this.logger.log(`Receiving WhatsApp message from ${dto.from} to ${dto.to}`);

    this.messageCounter++;
    const messageId = `mock_msg_${Date.now()}_${this.messageCounter}`;

    const business = await this.prisma.businesses.findFirst({
      where: { whatsapp_number: dto.to },
    });

    console.log("Found business for WhatsApp number:", business);

    // Get or create business and tenant (for demo, using defaults)
    const businessId = business.business_id;
    const tenantId = business.tenant_id;

    try {
      // Create a lead for this conversation
      const lead = await this.prisma.leads.create({
        data: {
          business_id: businessId,
          tenant_id: tenantId,
          source: "whatsapp",
          source_reference_id: messageId,
          platform_user_id: dto.from,
          phone: dto.from,
          status: "new",
          first_contact_at: new Date(),
          last_contact_at: new Date(),
          last_activity_at: new Date(),
        },
      });

      const leadId = lead.lead_id;
      this.logger.log(`Created lead: ${leadId}`);

      // Store message context for when AI responds
      this.pendingMessages.set(leadId, {
        from: dto.from,
        to: dto.to,
        originalMessage: dto.message,
        businessId,
        tenantId,
      });

      // Register this service as handler for AI responses
      this.kafkaConsumer.registerMessageHandler(leadId, {
        handleAiResponse: (aiResult: any) =>
          this.handleAiResponse(leadId, aiResult),
      });

      // Log initial message activity
      await this.prisma.lead_activities.create({
        data: {
          lead_id: leadId,
          business_id: businessId,
          tenant_id: tenantId,
          activity_type: "message_received",
          activity_description: "WhatsApp message received",
          actor_type: "customer",
          channel: "whatsapp",
          message_content: dto.message,
          metadata: {
            from: dto.from,
            to: dto.to,
            messageId,
          } as any,
          activity_timestamp: new Date(),
        },
      });

      // Send to AI for processing
      await this.kafkaProducer.requestAiProcessing({
        lead_id: leadId,
        business_id: businessId,
        text: dto.message,
        business_type: "service", // Valid options: 'retail' | 'd2c' | 'education' | 'service'
        priority: "normal",
      });

      this.logger.log(`Message sent to AI processing: ${leadId}`);

      const response: MessageResponse = {
        success: true,
        messageId,
        timestamp: new Date().toISOString(),
        to: dto.to,
        message: dto.message,
        status: "processing",
        leadId,
      };

      return response;
    } catch (error) {
      this.logger.error("Error processing message:", error);
      throw error;
    }
  }

  /**
   * Get or create default business for demo/testing
   */
  private async getOrCreateDefaultBusiness(): Promise<string> {
    const businessName = "WhatsApp Business";

    // Try to find existing business
    let business = await this.prisma.businesses.findFirst({
      where: { business_name: businessName },
    });

    if (!business) {
      // Create default business
      const tenantId = await this.getOrCreateDefaultTenant();
      business = await this.prisma.businesses.create({
        data: {
          tenant_id: tenantId,
          business_name: businessName,
          business_type: "service",
          whatsapp_number: "+919539192688",
        },
      });
      this.logger.log(`Created default business: ${business.business_id}`);
    }

    return business.business_id;
  }

  /**
   * Get or create default tenant for demo/testing
   */
  private async getOrCreateDefaultTenant(): Promise<string> {
    const tenantName = "Default Tenant";
    const tenantEmail = "default@whatsapp.business";

    // Try to find existing tenant
    let tenant = await this.prisma.tenants.findFirst({
      where: { email: tenantEmail },
    });

    if (!tenant) {
      // Create default tenant
      tenant = await this.prisma.tenants.create({
        data: {
          tenant_name: tenantName,
          email: tenantEmail,
          phone_number: "+919539192688",
        },
      });
      this.logger.log(`Created default tenant: ${tenant.tenant_id}`);
    }

    return tenant.tenant_id;
  }

  /**
   * Handle AI response for a message
   */
  private async handleAiResponse(leadId: string, aiResult: any) {
    console.log(`Received AI response for ===> ${leadId}`);
    const messageContext = this.pendingMessages.get(leadId);
    if (!messageContext) {
      this.logger.warn(`No message context found for ${leadId}`);
      return;
    }

    try {
      // Process AI result and determine actions
      const result = await this.messageHandler.processAiResult(aiResult);

      console.log(`AI processing result:`, result);

      // Send response if needed
        if (result.shouldRespond && result.responseMessage) {
          await this.sendWhatsAppResponse(
            messageContext.to,
            messageContext.from,
            result.responseMessage
          );
        }

      // Execute actions based on intent
      if (result.actions.length > 0) {
        await this.messageHandler.executeActions(result.actions, {
          lead_id: leadId,
          business_id: messageContext.businessId,
          tenant_id: messageContext.tenantId,
          intent: aiResult.intent?.intent || "UNKNOWN",
          entities: aiResult.entities,
        });
      }

      // Cleanup
      this.pendingMessages.delete(leadId);
    } catch (error) {
      this.logger.error(`Error handling AI response for ${leadId}:`, error);
    }
  }

  /**
   * Send WhatsApp response message
   */
  private async sendWhatsAppResponse(
    from: string,
    to: string,
    message: string
  ) {
    this.logger.log(
      `Sending WhatsApp response from ${from} to ${to}: ${message}`
    );

    // TODO: Implement actual WhatsApp Business API call
    // For now, just log it
    // In production:
    // await this.whatsappClient.sendMessage({ from, to, text: message });
  }

  async sendBulkMessages(
    messages: SendMessageDto[]
  ): Promise<MessageResponse[]> {
    this.logger.log(`Mock sending ${messages.length} WhatsApp messages`);

    const responses = await Promise.all(
      messages.map((msg) => this.sendMessage(msg))
    );

    return responses;
  }

  async getMessageStatus(
    messageId: string
  ): Promise<{ messageId: string; status: string; deliveredAt?: string }> {
    this.logger.log(`Mock getting status for message: ${messageId}`);

    await this.delay(50);

    // Mock different statuses randomly
    const statuses = ["sent", "delivered", "read"];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      messageId,
      status: randomStatus,
      deliveredAt:
        randomStatus !== "sent" ? new Date().toISOString() : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
