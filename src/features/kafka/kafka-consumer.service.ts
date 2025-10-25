import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EachMessagePayload } from 'kafkajs';

/**
 * Kafka Consumer Service
 * Consumes and processes events from Kafka topics
 */
@Injectable()
export class KafkaConsumerService {
  private readonly logger = new Logger(KafkaConsumerService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Start consuming messages
   */
  async consume() {
    const consumer = this.kafkaService.getConsumer();

    // Subscribe to topics
    await consumer.subscribe({
      topics: ['ai.process.result', 'ai.error'],
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
            `Received message from ${topic} [${partition}]: ${event.event_type}`,
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

    this.logger.log('Kafka consumer started');
  }

  /**
   * Route message to appropriate handler
   */
  private async handleMessage(topic: string, event: any) {
    switch (event.event_type) {
      case 'ai.process.result':
        await this.handleAiProcessResult(event);
        break;
      case 'ai.error':
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
      `Processing AI result for lead ${lead_id}: ${intent?.intent} (${intent?.confidence})`,
    );

    try {
      // Update lead with AI insights
      await this.prisma.leads.update({
        where: { lead_id },
        data: {
          intent_type: intent?.intent,
          extracted_entities: entities as any,
          custom_fields: {
            ai_confidence: intent?.confidence,
            ai_tier: intent?.tier,
            ai_processing_time: payload.processing_time_ms,
            ai_processed_at: new Date().toISOString(),
            suggested_actions,
            suggested_response,
          } as any,
          last_activity_at: new Date(),
        },
      });

      // Determine lead priority based on intent
      const priority = await this.classifyLeadPriority(
        intent?.intent,
        intent?.confidence,
      );

      if (priority) {
        await this.prisma.leads.update({
          where: { lead_id },
          data: { lead_quality: priority },
        });
      }

      // Create activity log
      await this.prisma.lead_activities.create({
        data: {
          lead_id,
          business_id: payload.business_id,
          tenant_id: payload.tenant_id || '', // You'll need to get this
          activity_type: 'ai_processed',
          activity_description: `AI detected intent: ${intent?.intent}`,
          actor_type: 'system',
          channel: 'ai',
          metadata: {
            intent: intent?.intent,
            confidence: intent?.confidence,
            entities,
          } as any,
          activity_timestamp: new Date(),
        },
      });

      this.logger.log(`Successfully updated lead ${lead_id} with AI insights`);
    } catch (error) {
      this.logger.error(
        `Failed to update lead ${lead_id} with AI result:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle AI processing error
   */
  private async handleAiError(event: any) {
    const { payload } = event;
    const { lead_id, error_message, error_type } = payload;

    this.logger.error(
      `AI processing error for lead ${lead_id}: ${error_message}`,
    );

    try {
      // Log the error in lead activities
      await this.prisma.lead_activities.create({
        data: {
          lead_id,
          business_id: payload.business_id,
          tenant_id: payload.tenant_id || '',
          activity_type: 'ai_error',
          activity_description: `AI processing failed: ${error_message}`,
          actor_type: 'system',
          channel: 'ai',
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
    confidence: number,
  ): Promise<string | null> {
    const highPriorityIntents = [
      'ORDER_REQUEST',
      'URGENT_REQUEST',
      'COMPLAINT',
      'PRICING_INQUIRY',
    ];

    const mediumPriorityIntents = [
      'AVAILABILITY_INQUIRY',
      'SCHEDULE_CALL',
      'BATCH_INFO_REQUEST',
      'CUSTOMIZATION_REQUEST',
    ];

    if (highPriorityIntents.includes(intent) && confidence > 0.7) {
      return 'hot';
    } else if (mediumPriorityIntents.includes(intent) && confidence > 0.6) {
      return 'warm';
    } else if (confidence > 0.5) {
      return 'cold';
    }

    return null;
  }

  /**
   * Disconnect consumer
   */
  async disconnect() {
    const consumer = this.kafkaService.getConsumer();
    await consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }
}
