import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseActionExecutor } from '../base-action.executor';
import { ActionContext, ActionResult } from '../action-executor.interface';

/**
 * Notifies sales team about new opportunity
 */
@Injectable()
export class NotifySalesExecutor extends BaseActionExecutor {
  constructor(private readonly prisma: PrismaService) {
    super(NotifySalesExecutor.name);
  }

  getActionType(): string {
    return 'notify_sales';
  }

  isRetryable(): boolean {
    return true; // Notifications can be retried
  }

  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // TODO: Implement actual notification logic
      // - Send email to sales team
      // - Create Slack notification
      // - Send SMS to on-call sales rep
      // - Update CRM system

      // For now, create a task record
      const task = await this.prisma.tasks.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          task_type: 'sales_notification',
          title: `New ${context.intent} from lead`,
          description: `Lead requires sales attention. Intent: ${context.intent}`,
          status: 'pending',
          priority: 'high',
          assigned_to_type: 'team',
          assigned_to_id: 'sales_team', // Placeholder
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          metadata: {
            intent: context.intent,
            entities: context.entities,
          } as any,
          created_at: new Date(),
        },
      });

      this.logger.log(`Created sales notification task: ${task.task_id}`);

      return this.createSuccessResult(
        'Sales team notified',
        { taskId: task.task_id }
      );
    } catch (error) {
      return this.createFailureResult(
        `Failed to notify sales team: ${error.message}`
      );
    }
  }
}
