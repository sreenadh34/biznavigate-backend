import { Injectable, Logger } from '@nestjs/common';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';

@Injectable()
export class ScriptAction implements ActionHandler {
  readonly type = 'script';
  private readonly logger = new Logger(ScriptAction.name);

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { script } = params;

    try {
      const func = new Function('context', script);
      return func(context);
    } catch (error) {
      this.logger.error('Script execution failed:', error);
      throw error;
    }
  }
}
