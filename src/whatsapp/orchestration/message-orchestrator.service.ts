import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageDeduplicatorService } from '../infrastructure/message-deduplicator.service';
import { DeadLetterQueueService } from '../infrastructure/dead-letter-queue.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { IntentHandlerFactoryService } from '../handlers/intent-handler-factory.service';
import { ActionExecutorFactoryService } from '../actions/action-executor-factory.service';
import { MetricsService, WhatsAppMetricsService } from '../observability/metrics.service';
import { TracingService } from '../observability/tracing.service';
import { IntentContext } from '../handlers/intent-handler.interface';
import { ActionContext } from '../actions/action-executor.interface';

/**
 * Message Orchestrator - Coordinates the entire message processing pipeline
 * Implements the Saga pattern for distributed transaction management
 */
@Injectable()
export class MessageOrchestratorService {
  private readonly logger = new Logger(MessageOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deduplicator: MessageDeduplicatorService,
    private readonly dlq: DeadLetterQueueService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly intentHandlerFactory: IntentHandlerFactoryService,
    private readonly actionExecutorFactory: ActionExecutorFactoryService,
    private readonly metrics: MetricsService,
    private readonly whatsappMetrics: WhatsAppMetricsService,
    private readonly tracing: TracingService
  ) {}

  /**
   * Main orchestration method - processes AI result through entire pipeline
   */
  async orchestrateMessageProcessing(aiResult: {
    processing_id: string;
    lead_id: string;
    business_id: string;
    tenant_id?: string;
    intent: any;
    entities: any;
    suggested_actions: string[];
    suggested_response?: string;
    processing_time_ms: number;
  }): Promise<{
    success: boolean;
    responseMessage?: string;
    actions: string[];
    executedActions: string[];
    failedActions: string[];
  }> {
    const traceId = this.tracing.startTrace('message_processing', {
      leadId: aiResult.lead_id,
      processingId: aiResult.processing_id,
    });

    let attemptCount = 0;
    const firstAttemptAt = new Date();

    try {
      // Step 1: Deduplication check
      const isDuplicate = await this.checkDuplication(
        aiResult.processing_id,
        aiResult.lead_id,
        traceId
      );

      if (isDuplicate) {
        this.tracing.endSpan(traceId, 'success');
        return {
          success: true,
          actions: [],
          executedActions: [],
          failedActions: [],
        };
      }

      // Step 2: Validate AI result
      this.validateAiResult(aiResult, traceId);

      // Step 3: Get tenant_id if not provided
      const tenantId = await this.ensureTenantId(aiResult, traceId);

      // Step 4: Track AI metrics
      this.trackAiMetrics(aiResult, traceId);

      // Step 5: Process intent with handler
      const intentResult = await this.processIntent(
        aiResult,
        tenantId,
        traceId
      );

      // Step 6: Execute actions with saga pattern
      const actionResults = await this.executeActions(
        intentResult.actions,
        aiResult,
        tenantId,
        traceId
      );

      // Step 7: Mark as processed
      await this.deduplicator.markAsProcessed(
        aiResult.processing_id,
        aiResult.lead_id,
        'success'
      );

      // Step 8: Track success metrics
      this.metrics.recordSuccess('message_processing', {
        intent: aiResult.intent?.intent,
      });

      this.tracing.endSpan(traceId, 'success');

      return {
        success: true,
        responseMessage: intentResult.responseMessage,
        actions: intentResult.actions,
        executedActions: actionResults.succeeded,
        failedActions: actionResults.failed,
      };
    } catch (error) {
      this.logger.error(
        `Error orchestrating message processing for lead ${aiResult.lead_id}:`,
        error
      );

      attemptCount++;

      // Handle retry or send to DLQ
      await this.handleProcessingFailure(
        aiResult,
        error,
        attemptCount,
        firstAttemptAt,
        traceId
      );

      this.tracing.endSpan(traceId, 'error');

      return {
        success: false,
        actions: [],
        executedActions: [],
        failedActions: [],
      };
    }
  }

  /**
   * Check for duplicate messages
   */
  private async checkDuplication(
    processingId: string,
    leadId: string,
    traceId: string
  ): Promise<boolean> {
    const spanId = this.tracing.startSpan(traceId, 'deduplication_check');

    try {
      const isDuplicate = await this.deduplicator.isDuplicate(
        processingId,
        leadId
      );

      if (isDuplicate) {
        this.logger.log(
          `Duplicate message detected: ${processingId}, skipping processing`
        );
        this.metrics.incrementCounter('message.duplicate', { leadId });
      }

      this.tracing.endSpan(spanId, 'success');
      return isDuplicate;
    } catch (error) {
      this.tracing.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * Validate AI result structure
   */
  private validateAiResult(aiResult: any, traceId: string): void {
    const spanId = this.tracing.startSpan(traceId, 'validation');

    if (!aiResult.lead_id || !aiResult.business_id) {
      this.tracing.endSpan(spanId, 'error');
      throw new Error('Invalid AI result: missing required fields');
    }

    this.tracing.endSpan(spanId, 'success');
  }

  /**
   * Ensure tenant_id is available
   */
  private async ensureTenantId(
    aiResult: any,
    traceId: string
  ): Promise<string> {
    if (aiResult.tenant_id) {
      return aiResult.tenant_id;
    }

    const spanId = this.tracing.startSpan(traceId, 'fetch_tenant_id');

    try {
      const lead = await this.prisma.leads.findUnique({
        where: { lead_id: aiResult.lead_id },
        select: { tenant_id: true },
      });

      if (!lead?.tenant_id) {
        throw new Error(
          `No tenant_id found for lead ${aiResult.lead_id}`
        );
      }

      this.tracing.endSpan(spanId, 'success');
      return lead.tenant_id;
    } catch (error) {
      this.tracing.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * Track AI processing metrics
   */
  private trackAiMetrics(aiResult: any, traceId: string): void {
    const intentType = aiResult.intent?.intent || 'UNKNOWN';
    const confidence = aiResult.intent?.confidence || 0;

    this.whatsappMetrics.trackAiProcessingTime(
      aiResult.processing_time_ms,
      intentType
    );

    this.whatsappMetrics.trackIntentDetected(intentType, confidence);

    this.tracing.addTags(traceId, {
      intent: intentType,
      confidence,
      processingTimeMs: aiResult.processing_time_ms,
    });
  }

  /**
   * Process intent with appropriate handler
   */
  private async processIntent(
    aiResult: any,
    tenantId: string,
    traceId: string
  ): Promise<{ actions: string[]; responseMessage: string }> {
    const spanId = this.tracing.startSpan(traceId, 'intent_processing');

    try {
      const context: IntentContext = {
        leadId: aiResult.lead_id,
        businessId: aiResult.business_id,
        tenantId,
        intent: aiResult.intent?.intent || 'UNKNOWN',
        confidence: aiResult.intent?.confidence || 0,
        entities: aiResult.entities || {},
        originalMessage: '', // TODO: Pass original message if available
      };

      const handler = this.intentHandlerFactory.getHandler(context);
      const result = await handler.handle(context);

      // Log AI activity
      await this.logAiActivity(aiResult, tenantId, result);

      this.tracing.endSpan(spanId, 'success');

      return {
        actions: result.actions,
        responseMessage: result.responseMessage,
      };
    } catch (error) {
      this.tracing.endSpan(spanId, 'error');
      throw error;
    }
  }

  /**
   * Execute actions with saga pattern (with compensation)
   */
  private async executeActions(
    actions: string[],
    aiResult: any,
    tenantId: string,
    traceId: string
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const spanId = this.tracing.startSpan(traceId, 'action_execution');

    const succeeded: string[] = [];
    const failed: string[] = [];
    const executedResults: any[] = [];

    for (const action of actions) {
      try {
        const executor = this.actionExecutorFactory.getExecutor(action);

        if (!executor) {
          this.logger.warn(`No executor found for action: ${action}`);
          failed.push(action);
          continue;
        }

        // Execute with circuit breaker
        const result = await this.circuitBreaker.execute(
          `action_${action}`,
          async () => {
            const context: ActionContext = {
              leadId: aiResult.lead_id,
              businessId: aiResult.business_id,
              tenantId,
              intent: aiResult.intent?.intent,
              entities: aiResult.entities || {},
            };

            return await executor.execute(context);
          }
        );

        if (result.success) {
          succeeded.push(action);
          executedResults.push({ action, result });
          this.whatsappMetrics.trackActionExecuted(action, true);
        } else {
          failed.push(action);
          this.whatsappMetrics.trackActionExecuted(action, false);

          // If action failed and it's critical, compensate previous actions
          if (!executor.isRetryable()) {
            await this.compensateActions(executedResults, aiResult, tenantId);
            break; // Stop executing further actions
          }
        }
      } catch (error) {
        this.logger.error(`Error executing action ${action}:`, error);
        failed.push(action);
        this.whatsappMetrics.trackActionExecuted(action, false);

        // Compensate on error
        await this.compensateActions(executedResults, aiResult, tenantId);
        break;
      }
    }

    this.tracing.addTags(spanId, {
      succeededCount: succeeded.length,
      failedCount: failed.length,
    });

    this.tracing.endSpan(spanId, failed.length === 0 ? 'success' : 'error');

    return { succeeded, failed };
  }

  /**
   * Compensate/rollback executed actions (Saga pattern)
   */
  private async compensateActions(
    executedResults: any[],
    aiResult: any,
    tenantId: string
  ): Promise<void> {
    this.logger.warn(
      `Compensating ${executedResults.length} executed actions for lead ${aiResult.lead_id}`
    );

    // Compensate in reverse order
    for (let i = executedResults.length - 1; i >= 0; i--) {
      const { action, result } = executedResults[i];

      try {
        const executor = this.actionExecutorFactory.getExecutor(action);

        if (executor && executor.compensate) {
          const context: ActionContext = {
            leadId: aiResult.lead_id,
            businessId: aiResult.business_id,
            tenantId,
            intent: aiResult.intent?.intent,
            entities: aiResult.entities || {},
          };

          await executor.compensate(context, result);
          this.logger.log(`Compensated action: ${action}`);
        }
      } catch (error) {
        this.logger.error(`Error compensating action ${action}:`, error);
        // Continue compensating other actions even if one fails
      }
    }
  }

  /**
   * Log AI activity to database
   */
  private async logAiActivity(
    aiResult: any,
    tenantId: string,
    intentResult: any
  ): Promise<void> {
    try {
      await this.prisma.lead_activities.create({
        data: {
          lead_id: aiResult.lead_id,
          business_id: aiResult.business_id,
          tenant_id: tenantId,
          activity_type: 'ai_processed',
          activity_description: `AI detected intent: ${aiResult.intent?.intent} (confidence: ${aiResult.intent?.confidence})`,
          actor_type: 'system',
          channel: 'ai',
          metadata: {
            processing_id: aiResult.processing_id,
            intent: aiResult.intent?.intent,
            confidence: aiResult.intent?.confidence,
            entities: aiResult.entities,
            suggested_actions: intentResult.actions,
            processing_time_ms: aiResult.processing_time_ms,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log AI activity:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Handle processing failure - retry or send to DLQ
   */
  private async handleProcessingFailure(
    aiResult: any,
    error: any,
    attemptCount: number,
    firstAttemptAt: Date,
    traceId: string
  ): Promise<void> {
    this.metrics.recordFailure('message_processing', error.message, {
      intent: aiResult.intent?.intent,
    });

    if (this.dlq.shouldRetry(attemptCount)) {
      // Mark for retry
      await this.deduplicator.markAsProcessed(
        aiResult.processing_id,
        aiResult.lead_id,
        'retrying'
      );

      const delay = this.dlq.getRetryDelay(attemptCount);
      this.logger.log(
        `Will retry processing after ${delay}ms (attempt ${attemptCount})`
      );

      // TODO: Schedule retry (e.g., using Bull queue or similar)
    } else {
      // Send to DLQ
      await this.dlq.sendToDeadLetter({
        messageId: aiResult.processing_id,
        leadId: aiResult.lead_id,
        originalPayload: aiResult,
        error: error.message,
        errorStack: error.stack,
        attemptCount,
        firstAttemptAt,
        lastAttemptAt: new Date(),
      });

      this.whatsappMetrics.trackDeadLetterQueue('max_retries_exceeded');
    }
  }
}
