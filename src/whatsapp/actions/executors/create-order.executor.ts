import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseActionExecutor } from '../base-action.executor';
import { ActionContext, ActionResult } from '../action-executor.interface';

/**
 * Creates a draft order in the system
 */
@Injectable()
export class CreateOrderExecutor extends BaseActionExecutor {
  constructor(private readonly prisma: PrismaService) {
    super(CreateOrderExecutor.name);
  }

  getActionType(): string {
    return 'create_order';
  }

  isRetryable(): boolean {
    return false; // Orders should not be duplicated
  }

  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      const { product, quantity, urgency } = context.entities;

      // TODO: Implement actual order creation logic
      // - Validate product exists
      // - Check inventory availability
      // - Calculate pricing
      // - Create order in ERP/Order Management System
      // - Reserve inventory
      // - Send order confirmation

      // For now, create a task for order processing
      const orderTask = await this.prisma.tasks.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          task_type: 'order_processing',
          title: `Process order request from lead`,
          description: `Create order: ${quantity || 'N/A'} units of ${product || 'unspecified product'}`,
          status: 'pending',
          priority: urgency === 'urgent' ? 'high' : 'normal',
          assigned_to_type: 'team',
          assigned_to_id: 'order_processing_team',
          due_date: new Date(
            Date.now() + (urgency === 'urgent' ? 4 : 48) * 60 * 60 * 1000
          ),
          metadata: {
            intent: context.intent,
            orderDetails: { product, quantity, urgency },
            entities: context.entities,
          } as any,
          created_at: new Date(),
        },
      });

      // Log the order creation activity
      await this.prisma.lead_activities.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          activity_type: 'order_initiated',
          activity_description: `Draft order created for ${quantity || 'N/A'} units`,
          actor_type: 'system',
          channel: 'automation',
          metadata: {
            taskId: orderTask.task_id,
            orderDetails: { product, quantity, urgency },
          } as any,
          activity_timestamp: new Date(),
        },
      });

      return this.createSuccessResult('Order task created', {
        taskId: orderTask.task_id,
        orderDetails: { product, quantity, urgency },
      });
    } catch (error) {
      return this.createFailureResult(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Compensate by canceling the order
   */
  async compensate(
    context: ActionContext,
    originalResult: ActionResult
  ): Promise<void> {
    if (originalResult.data?.taskId) {
      try {
        await this.prisma.tasks.update({
          where: { task_id: originalResult.data.taskId },
          data: {
            status: 'cancelled',
            metadata: {
              ...(originalResult.data.metadata || {}),
              cancelledReason: 'Compensating transaction',
            } as any,
          },
        });

        this.logger.log(
          `Compensated order task ${originalResult.data.taskId} for lead ${context.leadId}`
        );
      } catch (error) {
        this.logger.error('Failed to compensate order creation:', error);
      }
    }
  }
}
