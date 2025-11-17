import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles UNKNOWN or unrecognized intents
 * Always escalates to human agent
 */
@Injectable()
export class UnknownIntentHandler extends BaseIntentHandler {
  constructor() {
    super(UnknownIntentHandler.name);
  }

  getIntentType(): string {
    return 'UNKNOWN';
  }

  getPriority(): number {
    return 1; // Lowest priority - fallback handler
  }

  canHandle(context: IntentContext): boolean {
    // This handler accepts any intent with low confidence or explicit UNKNOWN
    return context.intent === 'UNKNOWN' || context.confidence < this.MIN_CONFIDENCE;
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = [
      'flag_for_review',
      'notify_agent',
      'requires_human_intervention',
    ];

    let message =
      'Thank you for your message. Our team will review this and get back to you soon.';

    // If message seems urgent despite low confidence
    if (
      context.originalMessage.toLowerCase().includes('urgent') ||
      context.originalMessage.toLowerCase().includes('emergency')
    ) {
      actions.push('priority_high', 'notify_supervisor');
      message =
        "Thank you for reaching out. We understand this may be urgent. A team member will contact you as soon as possible.";
    }

    return this.createResponse(actions, message, true, {
      reason: 'low_confidence_or_unknown_intent',
      originalIntent: context.intent,
      confidence: context.confidence,
    });
  }
}
