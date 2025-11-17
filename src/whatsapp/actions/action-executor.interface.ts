/**
 * Action Executor Interface
 * Executes specific actions based on intent processing results
 */

export interface ActionContext {
  leadId: string;
  businessId: string;
  tenantId: string;
  intent: string;
  entities: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  actionType: string;
  message?: string;
  data?: any;
  error?: string;
}

export interface IActionExecutor {
  /**
   * The action type this executor handles
   */
  getActionType(): string;

  /**
   * Execute the action
   */
  execute(context: ActionContext): Promise<ActionResult>;

  /**
   * Check if execution can be retried on failure
   */
  isRetryable(): boolean;

  /**
   * Compensate/rollback action (for Saga pattern)
   */
  compensate?(context: ActionContext, originalResult: ActionResult): Promise<void>;
}
