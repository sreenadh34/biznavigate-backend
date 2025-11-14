import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IActionExecutor } from './action-executor.interface';
import { NotifySalesExecutor } from './executors/notify-sales.executor';
import { CreateOrderExecutor } from './executors/create-order.executor';
import { CreateSupportTicketExecutor } from './executors/create-support-ticket.executor';
import { FlagForReviewExecutor } from './executors/flag-for-review.executor';

/**
 * Action Executor Factory
 * Creates and manages action executors
 */
@Injectable()
export class ActionExecutorFactoryService {
  private readonly logger = new Logger(ActionExecutorFactoryService.name);
  private executors: Map<string, IActionExecutor> = new Map();

  constructor(private readonly prisma: PrismaService) {
    this.registerDefaultExecutors();
  }

  /**
   * Register all default action executors
   */
  private registerDefaultExecutors(): void {
    const defaultExecutors: IActionExecutor[] = [
      new NotifySalesExecutor(this.prisma),
      new CreateOrderExecutor(this.prisma),
      new CreateSupportTicketExecutor(this.prisma),
      new FlagForReviewExecutor(this.prisma),
      // Add more executors here as needed
    ];

    defaultExecutors.forEach((executor) => {
      this.executors.set(executor.getActionType(), executor);
    });

    this.logger.log(
      `Registered ${this.executors.size} action executors: ${Array.from(this.executors.keys()).join(', ')}`
    );
  }

  /**
   * Get executor for specific action type
   */
  getExecutor(actionType: string): IActionExecutor | undefined {
    return this.executors.get(actionType);
  }

  /**
   * Check if executor exists for action
   */
  hasExecutor(actionType: string): boolean {
    return this.executors.has(actionType);
  }

  /**
   * Register a custom executor
   */
  registerExecutor(executor: IActionExecutor): void {
    this.executors.set(executor.getActionType(), executor);
    this.logger.log(`Registered custom executor: ${executor.getActionType()}`);
  }

  /**
   * Get all registered executors
   */
  getAllExecutors(): IActionExecutor[] {
    return Array.from(this.executors.values());
  }

  /**
   * Get all action types
   */
  getAllActionTypes(): string[] {
    return Array.from(this.executors.keys());
  }
}
