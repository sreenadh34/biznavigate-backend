import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseActionExecutor } from '../base-action.executor';
import { ActionContext, ActionResult } from '../action-executor.interface';

/**
 * Flags lead for manual review by human agent
 */
@Injectable()
export class FlagForReviewExecutor extends BaseActionExecutor {
  constructor(private readonly prisma: PrismaService) {
    super(FlagForReviewExecutor.name);
  }

  getActionType(): string {
    return 'flag_for_review';
  }

  isRetryable(): boolean {
    return true;
  }

  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      // Update lead status to require review
      await this.prisma.leads.update({
        where: { lead_id: context.leadId },
        data: {
          status: 'needs_review',
          // lead_status: 'warm', // Escalated to warm
          // priority: 'medium',
          
          updated_at: new Date(),
        },
      });

      // Create review task
      const task = await this.prisma.tasks.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          task_type: 'manual_review',
          title: 'Lead requires manual review',
          description: `AI confidence was low or intent unclear. Manual review needed.`,
          status: 'pending',
          priority: 'medium',
          assigned_to_type: 'role',
          assigned_to_id: 'agent', // Any available agent
          due_date: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
          metadata: {
            intent: context.intent,
            reason: 'low_confidence_or_unclear_intent',
            entities: context.entities,
          } as any,
          created_at: new Date(),
        },
      });

      // Log the flagging
      await this.prisma.lead_activities.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          activity_type: 'flagged_for_review',
          activity_description: 'Lead flagged for manual review due to low AI confidence',
          actor_type: 'system',
          channel: 'automation',
          metadata: {
            taskId: task.task_id,
            reason: 'low_confidence',
          } as any,
          activity_timestamp: new Date(),
        },
      });

      return this.createSuccessResult('Lead flagged for review', {
        taskId: task.task_id,
      });
    } catch (error) {
      return this.createFailureResult(
        `Failed to flag lead for review: ${error.message}`
      );
    }
  }
}
