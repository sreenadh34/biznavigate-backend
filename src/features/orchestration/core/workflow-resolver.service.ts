import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowDefinition } from '../types/workflow.types';

/**
 * Resolves the correct workflow for a given business and intent
 */
@Injectable()
export class WorkflowResolverService {
  private readonly logger = new Logger(WorkflowResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve workflow for a business + intent combination
   * Resolution order:
   * 1. Business-specific workflow (if exists)
   * 2. Business-type default workflow
   * 3. Fallback to UNKNOWN workflow
   */
  async resolveWorkflow(
    businessId: string,
    intent: string,
  ): Promise<{
    workflowId: string;
    workflowKey: string;
    workflowName: string;
    definition: WorkflowDefinition;
  }> {
    this.logger.debug(`Resolving workflow for business ${businessId}, intent ${intent}`);

    // Try to find assigned workflow for this business + intent
    let workflow = await this.prisma.business_workflows.findFirst({
      where: {
        business_id: businessId,
        intent_name: intent,
        is_active: true,
      },
      include: {
        workflow_definitions: true,
      },
    });

    // If not found, try fallback to UNKNOWN intent for this business
    if (!workflow) {
      this.logger.debug(`No workflow found for intent ${intent}, trying UNKNOWN for business`);

      workflow = await this.prisma.business_workflows.findFirst({
        where: {
          business_id: businessId,
          intent_name: 'UNKNOWN',
          is_active: true,
        },
        include: {
          workflow_definitions: true,
        },
      });
    }

    // If still not found, try to get business_type and use default workflows
    if (!workflow) {
      this.logger.debug(`No business-specific workflow found, checking business_type defaults`);

      // Get the business to find its type
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
        select: { business_type: true },
      });

      if (!business) {
        throw new NotFoundException(`Business ${businessId} not found`);
      }

      this.logger.debug(`Business type: ${business.business_type}, looking for default workflow`);

      // Try to find default workflow for this business_type + intent
      let defaultWorkflow = await this.prisma.workflow_definitions.findFirst({
        where: {
          business_type: business.business_type,
          intent_name: intent,
          is_active: true,
        },
      });

      // If not found, try UNKNOWN default for this business_type
      if (!defaultWorkflow) {
        this.logger.debug(`No default workflow for intent ${intent}, trying UNKNOWN default`);

        defaultWorkflow = await this.prisma.workflow_definitions.findFirst({
          where: {
            business_type: business.business_type,
            intent_name: 'UNKNOWN',
            is_active: true,
          },
        });
      }

      if (!defaultWorkflow) {
        throw new NotFoundException(
          `No workflow found for business ${businessId} (type: ${business.business_type}) and intent ${intent}`,
        );
      }

      // Return the default workflow
      return {
        workflowId: defaultWorkflow.workflow_id,
        workflowKey: defaultWorkflow.workflow_key,
        workflowName: defaultWorkflow.workflow_name,
        definition: defaultWorkflow.workflow_definition as unknown as WorkflowDefinition,
      };
    }

    const workflowDef = workflow.workflow_definitions;

    return {
      workflowId: workflowDef.workflow_id,
      workflowKey: workflowDef.workflow_key,
      workflowName: workflowDef.workflow_name,
      definition: workflowDef.workflow_definition as unknown as WorkflowDefinition,
    };
  }

  /**
   * Get all workflows assigned to a business
   */
  async getBusinessWorkflows(businessId: string) {
    const workflows = await this.prisma.business_workflows.findMany({
      where: {
        business_id: businessId,
        is_active: true,
      },
      include: {
        workflow_definitions: true,
      },
      orderBy: {
        intent_name: 'asc',
      },
    });

    return workflows.map((w) => ({
      intent: w.intent_name,
      workflowId: w.workflow_definitions.workflow_id,
      workflowName: w.workflow_definitions.workflow_name,
      workflowKey: w.workflow_definitions.workflow_key,
    }));
  }
}
