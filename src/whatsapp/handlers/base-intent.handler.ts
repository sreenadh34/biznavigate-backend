import { Logger } from '@nestjs/common';
import {
  IIntentHandler,
  IntentContext,
  IntentHandlerResult,
} from './intent-handler.interface';

/**
 * Base Intent Handler - Abstract class with common functionality
 */
export abstract class BaseIntentHandler implements IIntentHandler {
  protected readonly logger: Logger;
  protected readonly MIN_CONFIDENCE = 0.5;
  protected readonly HIGH_CONFIDENCE = 0.8;

  constructor(protected readonly loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  abstract getIntentType(): string;
  abstract getPriority(): number;
  protected abstract processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult>;

  /**
   * Default implementation - can be overridden
   */
  canHandle(context: IntentContext): boolean {
    return (
      context.intent === this.getIntentType() &&
      context.confidence >= this.MIN_CONFIDENCE
    );
  }

  /**
   * Main handler with logging
   */
  async handle(context: IntentContext): Promise<IntentHandlerResult> {
    this.logger.log(
      `Handling ${context.intent} (confidence: ${context.confidence}) for lead ${context.leadId}`
    );

    try {
      const result = await this.processIntent(context);

      // Check if should escalate based on confidence
      if (context.confidence < this.HIGH_CONFIDENCE) {
        result.shouldEscalate = true;
        result.actions.push('flag_for_review');
      }

      return result;
    } catch (error) {
      this.logger.error(`Error handling ${context.intent}:`, error);
      throw error;
    }
  }

  /**
   * Helper to create standard response
   */
  protected createResponse(
    actions: string[],
    message: string,
    shouldEscalate: boolean = false,
    metadata: Record<string, any> = {}
  ): IntentHandlerResult {
    return {
      actions: [...new Set(actions)], // Remove duplicates
      responseMessage: message,
      shouldEscalate,
      metadata,
    };
  }
}
