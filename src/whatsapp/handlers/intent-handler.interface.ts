/**
 * Intent Handler Interface - Strategy Pattern
 * Each intent type has its own handler implementation
 */

export interface IntentContext {
  leadId: string;
  businessId: string;
  tenantId: string;
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  originalMessage: string;
  conversationHistory?: any[];
}

export interface IntentHandlerResult {
  actions: string[];
  responseMessage: string;
  shouldEscalate: boolean;
  metadata?: Record<string, any>;
}

export interface IIntentHandler {
  /**
   * The intent type this handler processes
   */
  getIntentType(): string;

  /**
   * Check if this handler can process the given context
   */
  canHandle(context: IntentContext): boolean;

  /**
   * Process the intent and return actions to take
   */
  handle(context: IntentContext): Promise<IntentHandlerResult>;

  /**
   * Get the priority of this handler (higher = more priority)
   */
  getPriority(): number;
}
