import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MessageOrchestratorService } from './orchestration/message-orchestrator.service';

/**
 * WhatsApp Message Handler Service
 * Processes AI results and sends appropriate WhatsApp responses
 *
 * REFACTORED: Now uses industry-standard patterns:
 * - Idempotency via deduplication
 * - Dead Letter Queue for failed messages
 * - Circuit breaker for external service protection
 * - Strategy pattern for intent handling
 * - Saga pattern for distributed transactions
 * - Comprehensive observability
 */
@Injectable()
export class WhatsAppMessageHandlerService {
  private readonly logger = new Logger(WhatsAppMessageHandlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: MessageOrchestratorService
  ) {}

  /**
   * Process AI result and determine action
   *
   * NEW: Delegates to MessageOrchestratorService which handles:
   * - Deduplication (idempotency)
   * - Intent handling (strategy pattern)
   * - Action execution (saga pattern with compensation)
   * - Error handling (DLQ + retry)
   * - Observability (metrics + tracing)
   */
  async processAiResult(aiResult: {
    lead_id: string;
    business_id: string;
    tenant_id?: string;
    processing_id: string;
    intent: any;
    entities: any;
    suggested_actions: string[];
    suggested_response?: string;
    processing_time_ms: number;
  }): Promise<{
    shouldRespond: boolean;
    responseMessage?: string;
    actions: string[];
    executedActions?: string[];
    failedActions?: string[];
  }> {
    this.logger.log(`Processing AI result for lead: ${aiResult.lead_id}`);

    try {
      // Delegate to orchestrator for full pipeline processing
      const result = await this.orchestrator.orchestrateMessageProcessing(
        aiResult
      );

      return {
        shouldRespond: !!result.responseMessage,
        responseMessage: result.responseMessage,
        actions: result.actions,
        executedActions: result.executedActions,
        failedActions: result.failedActions,
      };
    } catch (error) {
      this.logger.error(
        `Error processing AI result for lead ${aiResult.lead_id}:`,
        error
      );

      // Fallback to legacy behavior for backwards compatibility
      return this.legacyProcessAiResult(aiResult);
    }
  }

  /**
   * Legacy processing method (fallback)
   * Used if orchestrator fails or for gradual migration
   */
  private async legacyProcessAiResult(aiResult: any): Promise<{
    shouldRespond: boolean;
    responseMessage?: string;
    actions: string[];
  }> {
    const { intent, entities, suggested_actions, suggested_response } = aiResult;

    // Extract intent details
    const intentType = intent?.intent || "UNKNOWN";
    const confidence = intent?.confidence || 0;

    // Log AI processing activity
    await this.logAiActivity(aiResult, intentType, confidence);

    // Determine actions based on intent
    const actions = await this.determineActions(
      intentType,
      confidence,
      suggested_actions
    );

    // Generate response message
    const responseMessage = await this.generateResponse(
      intentType,
      entities,
      suggested_response,
      confidence
    );

    return {
      shouldRespond: !!responseMessage,
      responseMessage,
      actions,
    };
  }

  /**
   * Determine actions based on intent
   */
  private async determineActions(
    intentType: string,
    confidence: number,
    suggestedActions: string[]
  ): Promise<string[]> {
    const actions: string[] = [...suggestedActions];

    // High confidence intents
    if (confidence > 0.8) {
      switch (intentType) {
        case "ORDER_REQUEST":
          actions.push("create_order", "notify_sales");
          break;
        case "PRICING_INQUIRY":
          actions.push("send_price_list", "assign_to_sales");
          break;
        case "AVAILABILITY_INQUIRY":
          actions.push("check_inventory", "send_availability");
          break;
        case "COMPLAINT":
          actions.push("create_ticket", "notify_support", "priority_high");
          break;
        case "SCHEDULE_CALL":
          actions.push("create_calendar_event", "send_confirmation");
          break;
      }
    }

    // Medium confidence - need human review
    if (confidence > 0.5 && confidence <= 0.8) {
      actions.push("flag_for_review", "notify_agent");
    }

    // Low confidence - definitely need human
    if (confidence <= 0.5) {
      actions.push("requires_human_intervention", "notify_supervisor");
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Generate response message based on intent
   */
  private async generateResponse(
    intentType: string,
    entities: any,
    suggestedResponse?: string,
    confidence?: number
  ): Promise<string | undefined> {
    // If AI provided a good response, use it
    if (suggestedResponse && confidence && confidence > 0.7) {
      return suggestedResponse;
    }

    // Otherwise, use template-based responses
    const responses: Record<string, string> = {
      ORDER_REQUEST:
        "Thank you for your order request! Our team will get back to you shortly with the details.",
      PRICING_INQUIRY:
        "Thanks for your interest! Let me share our pricing information with you.",
      AVAILABILITY_INQUIRY:
        "Let me check the availability for you. I'll get back to you in a moment.",
      COMPLAINT:
        "I'm sorry to hear about this issue. We're escalating this to our support team right away.",
      SCHEDULE_CALL:
        "I'd be happy to schedule a call. Our team will reach out to confirm the timing.",
      GREETING:
        "Hello! Welcome to our service. How can I help you today?",
      UNKNOWN:
        "Thank you for your message. Our team will review this and get back to you soon.",
    };

    return responses[intentType] || responses.UNKNOWN;
  }

  /**
   * Log AI processing activity
   */
  private async logAiActivity(
    aiResult: any,
    intentType: string,
    confidence: number
  ) {
    try {
      // Fetch tenant_id from the lead if not provided
      let tenantId = aiResult.tenant_id;
      if (!tenantId) {
        const lead = await this.prisma.leads.findUnique({
          where: { lead_id: aiResult.lead_id },
          select: { tenant_id: true },
        });
        tenantId = lead?.tenant_id;
      }

      if (!tenantId) {
        this.logger.warn(`No tenant_id found for lead ${aiResult.lead_id}, skipping activity log`);
        return;
      }

      await this.prisma.lead_activities.create({
        data: {
          lead_id: aiResult.lead_id,
          business_id: aiResult.business_id,
          tenant_id: tenantId,
          activity_type: "ai_processed",
          activity_description: `AI detected intent: ${intentType} (confidence: ${confidence})`,
          actor_type: "system",
          channel: "ai",
          metadata: {
            processing_id: aiResult.processing_id,
            intent: intentType,
            confidence,
            entities: aiResult.entities,
            suggested_actions: aiResult.suggested_actions,
            processing_time_ms: aiResult.processing_time_ms,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log AI activity:`, error);
    }
  }

  /**
   * Send WhatsApp message response
   */
  async sendWhatsAppResponse(
    to: string,
    from: string,
    message: string
  ): Promise<void> {
    // TODO: Implement actual WhatsApp API call
    // For now, just log it
    this.logger.log(`Sending WhatsApp message to ${to}: ${message}`);

    // In production, you would call WhatsApp Business API here
    // Example:
    // await this.whatsappClient.sendMessage({
    //   to,
    //   from,
    //   message
    // });
  }

  /**
   * Execute actions based on intent
   */
  async executeActions(
    actions: string[],
    context: {
      lead_id: string;
      business_id: string;
      tenant_id: string;
      intent: string;
      entities: any;
    }
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(action, context);
      } catch (error) {
        this.logger.error(`Failed to execute action ${action}:`, error);
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: string,
    context: {
      lead_id: string;
      business_id: string;
      tenant_id: string;
      intent: string;
      entities: any;
    }
  ): Promise<void> {
    this.logger.log(`Executing action: ${action} for lead ${context.lead_id}`);

    switch (action) {
      case "notify_sales":
        // TODO: Send notification to sales team
        this.logger.log("Notifying sales team");
        break;

      case "create_order":
        // TODO: Create order in system
        this.logger.log("Creating order");
        break;

      case "send_price_list":
        // TODO: Send price list
        this.logger.log("Sending price list");
        break;

      case "create_ticket":
        // TODO: Create support ticket
        this.logger.log("Creating support ticket");
        break;

      case "flag_for_review":
        // TODO: Flag lead for manual review
        this.logger.log("Flagging for review");
        break;

      case "notify_agent":
        // TODO: Notify agent
        this.logger.log("Notifying agent");
        break;

      case "priority_high":
        // TODO: Set high priority
        this.logger.log("Setting high priority");
        break;

      default:
        this.logger.debug(`Unknown action: ${action}`);
    }

    // Log action execution
    await this.prisma.lead_activities.create({
      data: {
        lead_id: context.lead_id,
        business_id: context.business_id,
        tenant_id: context.tenant_id,
        activity_type: "action_executed",
        activity_description: `Executed action: ${action}`,
        actor_type: "system",
        channel: "automation",
        metadata: {
          action,
          intent: context.intent,
          entities: context.entities,
        } as any,
        activity_timestamp: new Date(),
      },
    });
  }
}
