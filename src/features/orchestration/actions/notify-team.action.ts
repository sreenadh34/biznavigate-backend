import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';

@Injectable()
export class NotifyTeamAction implements ActionHandler {
  readonly type = 'notify_team';
  private readonly logger = new Logger(NotifyTeamAction.name);

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { team, message, priority } = params;

    this.logger.log(`[NOTIFICATION] Team: ${team}, Priority: ${priority || 'normal'}`);
    this.logger.log(`Message: ${message}`);

    // TODO: Implement actual notification (email, Slack, etc.)
    // For now, just log

    return { notified: true, team, timestamp: new Date().toISOString() };
  }
}
