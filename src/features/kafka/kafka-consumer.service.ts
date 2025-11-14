import { Injectable, Logger } from "@nestjs/common";
import { KafkaService } from "./kafka.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EachMessagePayload } from "kafkajs";

/**
 * Kafka Consumer Service
 * Consumes and processes events from Kafka topics
 */
@Injectable()
export class KafkaConsumerService {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private messageHandlers: Map<string, any> = new Map();

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Register a message handler for specific lead/business context
   */
  registerMessageHandler(handlerKey: string, handler: any) {
    this.messageHandlers.set(handlerKey, handler);
  }

  /**
   * Get registered message handler
   */
  getMessageHandler(handlerKey: string) {
    return this.messageHandlers.get(handlerKey);
  }

  /**
   * Start consuming messages
   */
  async consume() {
    const consumer = this.kafkaService.getConsumer();

    // Subscribe to topics
    await consumer.subscribe({
      topics: ["ai.process.result", "ai.error"],
      fromBeginning: false,
    });

    // Start consuming
    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, partition, message } = payload;

        try {
          const value = message.value?.toString();
          if (!value) return;

          const event = JSON.parse(value);

          this.logger.debug(
            `Received message from ${topic} [${partition}]: ${event.event_type}`
          );

          // Route to appropriate handler
          await this.handleMessage(topic, event);

          // Commit offset
          // await consumer.commitOffsets([
          //   {
          //     topic,
          //     partition,
          //     offset: (parseInt(message.offset) + 1).toString(),
          //   },
          // ]);
        } catch (error) {
          this.logger.error(`Error processing message from ${topic}:`, error);
          // Don't throw - continue processing other messages
        }
      },
    });

    this.logger.log("Kafka consumer started");
  }

  /**
   * Route message to appropriate handler
   */
  private async handleMessage(topic: string, event: any) {
    switch (event.event_type) {
      case "ai.process.result":
        await this.handleAiProcessResult(event);
        break;
      case "ai.error":
        await this.handleAiError(event);
        break;
      default:
        this.logger.warn(`Unknown event type: ${event.event_type}`);
    }
  }

  /**
   * Handle AI processing result
   */
  private async handleAiProcessResult(event: any) {
    const { payload } = event;
    const { lead_id, intent, entities, suggested_actions, suggested_response } =
      payload;

    this.logger.log(
      `Processing AI result for lead ${lead_id}: ${intent?.intent} (${intent?.confidence})`
    );

    console.dir(payload, { depth: null });

    // Emit event that can be handled by WhatsApp or other services
    // Store the result so it can be retrieved
    await this.storeAiResult(payload);

    // Check if there's a registered handler for this lead
    const handler = this.messageHandlers.get(lead_id);
    if (handler && typeof handler.handleAiResponse === 'function') {
      try {
        await handler.handleAiResponse(payload);
      } catch (error) {
        this.logger.error(`Error in message handler for ${lead_id}:`, error);
      }
    }
  }

  /**
   * Store AI result for retrieval
   */
  private async storeAiResult(payload: any) {
    try {
      // Fetch tenant_id from the lead if not provided
      let tenantId = payload.tenant_id;
      if (!tenantId) {
        const lead = await this.prisma.leads.findUnique({
          where: { lead_id: payload.lead_id },
          select: { tenant_id: true },
        });
        tenantId = lead?.tenant_id;
      }

      if (!tenantId) {
        this.logger.warn(`No tenant_id found for lead ${payload.lead_id}, skipping AI result storage`);
        return;
      }

      // Store in database or cache for later retrieval
      await this.prisma.lead_activities.create({
        data: {
          lead_id: payload.lead_id,
          business_id: payload.business_id,
          tenant_id: tenantId,
          activity_type: "ai_result_received",
          activity_description: `AI processing completed: ${payload.intent?.intent}`,
          actor_type: "system",
          channel: "ai",
          metadata: {
            processing_id: payload.processing_id,
            intent: payload.intent,
            entities: payload.entities,
            suggested_actions: payload.suggested_actions,
            suggested_response: payload.suggested_response,
            processing_time_ms: payload.processing_time_ms,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store AI result:`, error);
    }
  }

  /**
   * Handle AI processing error
   */
  private async handleAiError(event: any) {
    const { payload } = event;
    const { lead_id, error_message, error_type } = payload;

    this.logger.error(
      `AI processing error for lead ${lead_id}: ${error_message}`
    );

    try {
      // Fetch tenant_id from the lead if not provided
      let tenantId = payload.tenant_id;
      if (!tenantId) {
        const lead = await this.prisma.leads.findUnique({
          where: { lead_id },
          select: { tenant_id: true },
        });
        tenantId = lead?.tenant_id;
      }

      if (!tenantId) {
        this.logger.warn(`No tenant_id found for lead ${lead_id}, skipping AI error log`);
        return;
      }

      // Log the error in lead activities
      await this.prisma.lead_activities.create({
        data: {
          lead_id,
          business_id: payload.business_id,
          tenant_id: tenantId,
          activity_type: "ai_error",
          activity_description: `AI processing failed: ${error_message}`,
          actor_type: "system",
          channel: "ai",
          metadata: {
            error_type,
            error_message,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log AI error for lead ${lead_id}:`, error);
    }
  }

  /**
   * Classify lead priority based on intent
   */
  private async classifyLeadPriority(
    intent: string,
    confidence: number
  ): Promise<string | null> {
    const highPriorityIntents = [
      "ORDER_REQUEST",
      "URGENT_REQUEST",
      "COMPLAINT",
      "PRICING_INQUIRY",
    ];

    const mediumPriorityIntents = [
      "AVAILABILITY_INQUIRY",
      "SCHEDULE_CALL",
      "BATCH_INFO_REQUEST",
      "CUSTOMIZATION_REQUEST",
    ];

    if (highPriorityIntents.includes(intent) && confidence > 0.7) {
      return "hot";
    } else if (mediumPriorityIntents.includes(intent) && confidence > 0.6) {
      return "warm";
    } else if (confidence > 0.5) {
      return "cold";
    }

    return null;
  }

  /**
   * Disconnect consumer
   */
  async disconnect() {
    const consumer = this.kafkaService.getConsumer();
    await consumer.disconnect();
    this.logger.log("Kafka consumer disconnected");
  }
}
