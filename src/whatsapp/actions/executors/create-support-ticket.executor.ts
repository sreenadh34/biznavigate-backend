import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseActionExecutor } from '../base-action.executor';
import { ActionContext, ActionResult } from '../action-executor.interface';

/**
 * Creates a support ticket for complaints and issues
 */
@Injectable()
export class CreateSupportTicketExecutor extends BaseActionExecutor {
  constructor(private readonly prisma: PrismaService) {
    super(CreateSupportTicketExecutor.name);
  }

  getActionType(): string {
    return 'create_support_ticket';
  }

  isRetryable(): boolean {
    return false; // Avoid duplicate tickets
  }

  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    try {
      const { severity, category, orderId } = context.entities;
      const isCritical =
        severity === 'critical' ||
        severity === 'urgent' ||
        context.metadata?.requiresImmediateAction;

      // TODO: Implement actual ticket system integration
      // - Create ticket in help desk system (Zendesk, Freshdesk, etc.)
      // - Assign to appropriate team based on category
      // - Set SLA based on severity
      // - Send notifications

      const ticket = await this.prisma.tasks.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          task_type: 'support_ticket',
          title: `Support needed: ${category || 'General complaint'}`,
          description: `Customer complaint/issue reported via WhatsApp`,
          status: 'pending',
          priority: isCritical ? 'critical' : 'high',
          assigned_to_type: 'team',
          assigned_to_id: 'support_team',
          due_date: new Date(
            Date.now() + (isCritical ? 1 : 24) * 60 * 60 * 1000
          ),
          metadata: {
            intent: context.intent,
            ticketDetails: { severity, category, orderId },
            entities: context.entities,
            isCritical,
          } as any,
          created_at: new Date(),
        },
      });

      // Log ticket creation
      await this.prisma.lead_activities.create({
        data: {
          lead_id: context.leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          activity_type: 'support_ticket_created',
          activity_description: `Support ticket #${ticket.task_id} created - ${category || 'General'}`,
          actor_type: 'system',
          channel: 'automation',
          metadata: {
            ticketId: ticket.task_id,
            severity,
            category,
            orderId,
          } as any,
          activity_timestamp: new Date(),
        },
      });

      return this.createSuccessResult('Support ticket created', {
        ticketId: ticket.task_id,
        severity: isCritical ? 'critical' : 'high',
      });
    } catch (error) {
      return this.createFailureResult(
        `Failed to create support ticket: ${error.message}`
      );
    }
  }
}
