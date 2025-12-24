import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from '../../kafka/kafka-consumer.service';
import { WorkflowOrchestratorService } from '../core/workflow-orchestrator.service';
import { AiProcessResult } from '../types/workflow.types';

/**
 * Consumes AI processing results from Kafka and routes them to workflow orchestration
 * This is a GLOBAL handler that processes ALL AI results (not per-lead)
 */
@Injectable()
export class AiResultConsumerService implements OnModuleInit {
  private readonly logger = new Logger(AiResultConsumerService.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly workflowOrchestrator: WorkflowOrchestratorService,
  ) {}

  async onModuleInit() {
    // Register GLOBAL handler for all AI results
    // This handler will be called for EVERY AI result that comes through
    this.kafkaConsumer.registerMessageHandler('workflow-orchestration-global', {
      handleAiResponse: async (aiResult: AiProcessResult) => {
        await this.handleAiResult(aiResult);
      },
    });

    this.logger.log('✅ Workflow Orchestration Consumer initialized - listening for ALL AI results');
  }

  private async handleAiResult(aiResult: AiProcessResult): Promise<void> {
    try {
      this.logger.log(`🔄 Processing AI result for lead ${aiResult.lead_id}, intent: ${aiResult.intent?.intent}`);

      // Delegate to workflow orchestrator
      await this.workflowOrchestrator.processAiResult(aiResult);

      this.logger.log(`✅ Workflow execution completed for lead ${aiResult.lead_id}`);
    } catch (error) {
      this.logger.error(`❌ Error processing AI result for lead ${aiResult.lead_id}:`, error);
      // TODO: Send to dead letter queue
      throw error; // Re-throw to ensure Kafka consumer knows it failed
    }
  }
}
