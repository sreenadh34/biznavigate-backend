import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler } from '../types/workflow.types';

/**
 * Registry for all action handlers
 * Manages registration and retrieval of action handlers
 */
@Injectable()
export class ActionRegistryService {
  private readonly logger = new Logger(ActionRegistryService.name);
  private readonly handlers = new Map<string, ActionHandler>();

  /**
   * Register an action handler
   */
  registerHandler(handler: ActionHandler): void {
    this.handlers.set(handler.type, handler);
    this.logger.log(`Registered action handler: ${handler.type}`);
  }

  /**
   * Get action handler by type
   */
  getHandler(type: string): ActionHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Get all registered action types
   */
  getAllTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if handler exists
   */
  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }
}
