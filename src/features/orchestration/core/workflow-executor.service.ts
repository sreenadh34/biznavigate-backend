import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowState,
  WorkflowTransition,
  WorkflowAction,
  WorkflowCondition,
} from '../types/workflow.types';
import { ActionRegistryService } from '../actions/action-registry.service';

/**
 * Executes workflow definitions
 */
@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actionRegistry: ActionRegistryService,
  ) {}

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    workflowKey: string,
    intentName: string,
    definition: WorkflowDefinition,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult> {
    const executionId = await this.createExecution(
      workflowId,
      workflowKey,
      intentName,
      context,
    );

    this.logger.log(
      `Starting workflow execution ${executionId} for lead ${context.leadId}`,
    );

    try {
      let currentState = definition.initialState;
      let iterations = 0;
      const maxIterations = 50; // Prevent infinite loops

      while (currentState !== 'end' && iterations < maxIterations) {
        iterations++;

        const state = definition.states[currentState];

        if (!state) {
          throw new Error(`State ${currentState} not found in workflow`);
        }

        this.logger.debug(
          `Executing state: ${currentState} (iteration ${iterations})`,
        );

        // Execute state and get next state
        const nextState = await this.executeState(state, context);

        // Update execution record
        await this.updateExecution(executionId, currentState);

        if (nextState === '__WAITING__') {
          // Workflow is waiting for external event
          await this.markExecutionWaiting(executionId);
          return {
            executionId,
            workflowId,
            status: 'waiting',
            finalState: currentState,
            context,
          };
        }

        currentState = nextState;
      }

      if (iterations >= maxIterations) {
        throw new Error(`Workflow exceeded maximum iterations (${maxIterations})`);
      }

      // Mark execution as completed
      await this.completeExecution(executionId, 'end');

      this.logger.log(`Workflow execution ${executionId} completed successfully`);

      return {
        executionId,
        workflowId,
        status: 'completed',
        finalState: 'end',
        context,
      };
    } catch (error) {
      this.logger.error(`Workflow execution ${executionId} failed:`, error);

      await this.failExecution(executionId, error.message);

      return {
        executionId,
        workflowId,
        status: 'failed',
        finalState: 'error',
        context,
        error: error.message,
      };
    }
  }

  /**
   * Execute a single workflow state
   */
  private async executeState(
    state: WorkflowState,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    switch (state.type) {
      case 'action':
        return this.executeActionState(state, context);

      case 'decision':
        return this.executeDecisionState(state, context);

      case 'wait':
        return '__WAITING__';

      case 'end':
        return 'end';

      default:
        throw new Error(`Unknown state type: ${state.type}`);
    }
  }

  /**
   * Execute action state - runs all actions in sequence
   */
  private async executeActionState(
    state: WorkflowState,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    // Execute all actions
    for (const action of state.actions || []) {
      // Check condition
      if (action.condition) {
        const shouldExecute = this.evaluateCondition(action.condition, context);
        if (!shouldExecute) {
          this.logger.debug(`Skipping action ${action.actionId} due to condition`);
          continue;
        }
      }

      // Get action handler
      const handler = this.actionRegistry.getHandler(action.type);
      if (!handler) {
        throw new Error(`Action handler not found: ${action.type}`);
      }

      // Resolve template variables in params
      const resolvedParams = this.resolveTemplateVariables(action.params, context);

      // Execute action
      this.logger.debug(`Executing action: ${action.actionId} (type: ${action.type})`);

      try {
        const result = await handler.execute(resolvedParams, context);

        // Store result in context if output variable specified
        if (action.outputVariable) {
          context[action.outputVariable] = result;
        }
      } catch (error) {
        this.logger.error(`Action ${action.actionId} failed:`, error);
        // For now, continue with other actions
        // TODO: Implement proper error handling based on workflow config
      }
    }

    // Determine next state
    return this.determineNextState(state.transitions, context);
  }

  /**
   * Execute decision state - only evaluates transitions
   */
  private async executeDecisionState(
    state: WorkflowState,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    return this.determineNextState(state.transitions, context);
  }

  /**
   * Determine next state based on transitions
   */
  private determineNextState(
    transitions: WorkflowTransition[] | undefined,
    context: WorkflowExecutionContext,
  ): string {
    if (!transitions || transitions.length === 0) {
      return 'end';
    }

    // Sort by priority (descending)
    const sortedTransitions = [...transitions].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    );

    // Find first matching transition
    for (const transition of sortedTransitions) {
      if (!transition.condition) {
        return transition.to;
      }

      const shouldTransition = this.evaluateCondition(transition.condition, context);
      if (shouldTransition) {
        return transition.to;
      }
    }

    // No transition matched
    return 'end';
  }

  /**
   * Evaluate a workflow condition
   */
  private evaluateCondition(
    condition: WorkflowCondition,
    context: WorkflowExecutionContext,
  ): boolean {
    if (condition.type === 'always') {
      return true;
    }

    if (condition.type === 'expression' && condition.expression) {
      return this.evaluateExpression(condition.expression, context);
    }

    if (condition.type === 'script' && condition.script) {
      return this.evaluateScript(condition.script, context);
    }

    return false;
  }

  /**
   * Evaluate JavaScript expression
   */
  private evaluateExpression(expression: string, context: any): boolean {
    try {
      // Create Function for safe evaluation
      const func = new Function('context', `return ${expression};`);
      return Boolean(func(context));
    } catch (error) {
      this.logger.error(`Error evaluating expression: ${expression}`, error);
      return false;
    }
  }

  /**
   * Evaluate JavaScript script
   */
  private evaluateScript(script: string, context: any): boolean {
    try {
      const func = new Function('context', script);
      const result = func(context);
      return Boolean(result);
    } catch (error) {
      this.logger.error(`Error evaluating script`, error);
      return false;
    }
  }

  /**
   * Resolve template variables like {{ context.variable }}
   */
  private resolveTemplateVariables(params: any, context: any): any {
    if (typeof params === 'string') {
      // Replace {{ variable }} with context value
      return params.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        const value = this.getNestedValue(context, path.trim());
        return value !== undefined ? value : match;
      });
    }

    if (Array.isArray(params)) {
      return params.map((item) => this.resolveTemplateVariables(item, context));
    }

    if (typeof params === 'object' && params !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(params)) {
        resolved[key] = this.resolveTemplateVariables(value, context);
      }
      return resolved;
    }

    return params;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ============================================================================
  // Execution Tracking
  // ============================================================================

  private async createExecution(
    workflowId: string,
    workflowKey: string,
    intentName: string,
    context: WorkflowExecutionContext,
  ): Promise<string> {
    const execution = await this.prisma.workflow_executions.create({
      data: {
        workflow_id: workflowId,
        business_id: context.businessId,
        lead_id: context.leadId,
        workflow_key: workflowKey,
        intent_name: intentName,
        status: 'running',
        execution_context: context as any,
      },
    });

    return execution.execution_id;
  }

  private async updateExecution(executionId: string, currentState: string) {
    await this.prisma.workflow_executions.update({
      where: { execution_id: executionId },
      data: {
        current_state: currentState,
        updated_at: new Date(),
      },
    });
  }

  private async completeExecution(executionId: string, finalState: string) {
    await this.prisma.workflow_executions.update({
      where: { execution_id: executionId },
      data: {
        status: 'completed',
        current_state: finalState,
        completed_at: new Date(),
      },
    });
  }

  private async failExecution(executionId: string, errorMessage: string) {
    await this.prisma.workflow_executions.update({
      where: { execution_id: executionId },
      data: {
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date(),
      },
    });
  }

  private async markExecutionWaiting(executionId: string) {
    await this.prisma.workflow_executions.update({
      where: { execution_id: executionId },
      data: {
        status: 'waiting',
      },
    });
  }
}
