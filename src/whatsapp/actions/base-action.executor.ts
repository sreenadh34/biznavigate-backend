import { Logger } from '@nestjs/common';
import {
  IActionExecutor,
  ActionContext,
  ActionResult,
} from './action-executor.interface';

/**
 * Base Action Executor - Abstract class with common functionality
 */
export abstract class BaseActionExecutor implements IActionExecutor {
  protected readonly logger: Logger;

  constructor(protected readonly loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  abstract getActionType(): string;
  abstract isRetryable(): boolean;
  protected abstract executeAction(context: ActionContext): Promise<ActionResult>;

  /**
   * Main execution with error handling and logging
   */
  async execute(context: ActionContext): Promise<ActionResult> {
    this.logger.log(
      `Executing action ${this.getActionType()} for lead ${context.leadId}`
    );

    try {
      const result = await this.executeAction(context);

      if (result.success) {
        this.logger.log(
          `Action ${this.getActionType()} completed successfully for lead ${context.leadId}`
        );
      } else {
        this.logger.warn(
          `Action ${this.getActionType()} failed for lead ${context.leadId}: ${result.error}`
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error executing action ${this.getActionType()} for lead ${context.leadId}:`,
        error
      );

      return {
        success: false,
        actionType: this.getActionType(),
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Default compensation - override if needed
   */
  async compensate(
    context: ActionContext,
    originalResult: ActionResult
  ): Promise<void> {
    this.logger.log(
      `No compensation defined for action ${this.getActionType()}`
    );
  }

  /**
   * Helper to create success result
   */
  protected createSuccessResult(
    message: string,
    data?: any
  ): ActionResult {
    return {
      success: true,
      actionType: this.getActionType(),
      message,
      data,
    };
  }

  /**
   * Helper to create failure result
   */
  protected createFailureResult(error: string): ActionResult {
    return {
      success: false,
      actionType: this.getActionType(),
      error,
    };
  }
}
