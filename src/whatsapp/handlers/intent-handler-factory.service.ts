import { Injectable, Logger } from '@nestjs/common';
import { IIntentHandler, IntentContext } from './intent-handler.interface';
import { OrderRequestHandler } from './implementations/order-request.handler';
import { PricingInquiryHandler } from './implementations/pricing-inquiry.handler';
import { ComplaintHandler } from './implementations/complaint.handler';
import { AvailabilityInquiryHandler } from './implementations/availability-inquiry.handler';
import { ScheduleCallHandler } from './implementations/schedule-call.handler';
import { GeneralInquiryHandler } from './implementations/general-inquiry.handler';
import { UnknownIntentHandler } from './implementations/unknown-intent.handler';

/**
 * Intent Handler Factory - Creates and manages intent handlers
 * Uses Strategy Pattern for flexible intent handling
 */
@Injectable()
export class IntentHandlerFactoryService {
  private readonly logger = new Logger(IntentHandlerFactoryService.name);
  private handlers: IIntentHandler[] = [];

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register all default intent handlers
   */
  private registerDefaultHandlers(): void {
    this.handlers = [
      new OrderRequestHandler(),
      new PricingInquiryHandler(),
      new ComplaintHandler(),
      new AvailabilityInquiryHandler(),
      new ScheduleCallHandler(),
      new GeneralInquiryHandler(),
      new UnknownIntentHandler(), // Fallback handler
    ];

    // Sort by priority (highest first)
    this.handlers.sort((a, b) => b.getPriority() - a.getPriority());

    this.logger.log(
      `Registered ${this.handlers.length} intent handlers: ${this.handlers.map((h) => h.getIntentType()).join(', ')}`
    );
  }

  /**
   * Get appropriate handler for the given context
   * Returns first handler that can handle the context
   */
  getHandler(context: IntentContext): IIntentHandler {
    console.log(`Selecting handler for intent: ===> ${context.intent}`);
    for (const handler of this.handlers) {
      if (handler.canHandle(context)) {
        this.logger.debug(
          `Selected ${handler.getIntentType()} handler for intent: ${context.intent}`
        );
        return handler;
      }
    }

    // Should never reach here as UnknownIntentHandler handles everything
    this.logger.warn(
      `No handler found for intent: ${context.intent}, using fallback`
    );
    return this.handlers[this.handlers.length - 1]; // Return last (fallback)
  }

  /**
   * Register a custom intent handler
   */
  registerHandler(handler: IIntentHandler): void {
    // Remove existing handler for same intent
    this.handlers = this.handlers.filter(
      (h) => h.getIntentType() !== handler.getIntentType()
    );

    this.handlers.push(handler);

    // Re-sort by priority
    this.handlers.sort((a, b) => b.getPriority() - a.getPriority());

    this.logger.log(`Registered custom handler: ${handler.getIntentType()}`);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): IIntentHandler[] {
    return [...this.handlers];
  }

  /**
   * Get handler by intent type
   */
  getHandlerByType(intentType: string): IIntentHandler | undefined {
    return this.handlers.find((h) => h.getIntentType() === intentType);
  }
}
