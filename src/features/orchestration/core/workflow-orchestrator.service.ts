import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowResolverService } from './workflow-resolver.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { AiProcessResult, WorkflowExecutionContext } from '../types/workflow.types';
import * as crypto from 'crypto';

@Injectable()
export class WorkflowOrchestratorService {
  private readonly logger = new Logger(WorkflowOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowResolver: WorkflowResolverService,
    private readonly workflowExecutor: WorkflowExecutorService,
    private readonly configService: ConfigService,
  ) {}

  async processAiResult(aiResult: AiProcessResult): Promise<void> {
    const { lead_id, business_id, tenant_id, intent, entities } = aiResult;

    this.logger.log(`Processing AI result for lead ${lead_id}, intent: ${intent.intent}`);

    // 1. Fetch lead details
    const lead = await this.prisma.leads.findUnique({
      where: { lead_id },
      include: { businesses: true },
    });

    if (!lead) {
      throw new Error(`Lead ${lead_id} not found`);
    }

    // 2. Fetch the most recent conversation (to get channel info)
    const conversation = await this.prisma.lead_conversations.findFirst({
      where: {
        lead_id,
        status: 'active',
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    if (!conversation) {
      throw new Error(`No active conversation found for lead ${lead_id}`);
    }

    const channel = conversation.channel;

    // 3. Get channel configuration
    const channelConfig = await this.getChannelConfig(business_id, channel);

    // 4. Resolve workflow
    const workflow = await this.workflowResolver.resolveWorkflow(
      business_id,
      intent.intent,
    );

    // 4. Get the most recent message from this conversation (for message_id)
    const recentMessage = await this.prisma.lead_messages.findFirst({
      where: {
        conversation_id: conversation.conversation_id,
        sender_type: 'customer',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 5. Build execution context
    // Check if there's an interactive_selection (from button/list click) and add it to entities
    const enrichedEntities = { ...entities };
    const interactiveSelection = aiResult.metadata?.interactive_selection || (aiResult as any).interactive_selection;
    if (interactiveSelection) {
      this.logger.log(`✅ Interactive selection detected: ${interactiveSelection}`);
      enrichedEntities.category_slug = interactiveSelection;
    }

    const context: WorkflowExecutionContext = {
      // AI Results
      intent: intent.intent,
      intentConfidence: intent.confidence,
      entities: enrichedEntities,
      suggestedActions: aiResult.suggested_actions,
      suggestedResponse: aiResult.suggested_response,

      // Lead & Business Info
      leadId: lead_id,
      businessId: business_id,
      tenantId: tenant_id || lead.tenant_id,
      leadName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      leadPhone: lead.phone,

      // Conversation Info
      conversationId: conversation.conversation_id,
      channel,
      messageId: recentMessage?.message_id,

      // Channel Config
      channelConfig,

      // Business Info
      business: {
        name: lead.businesses.business_name,
        type: lead.businesses.business_type,
      },

      // Store full AI result for access by actions
      aiResult,
    };

    console.dir(workflow, { depth: null });

    // 6. Execute workflow
    await this.workflowExecutor.execute(
      workflow.workflowId,
      workflow.workflowKey,
      intent.intent,
      workflow.definition,
      context,
    );
  }

  private async getChannelConfig(businessId: string, channel: string): Promise<any> {
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        business_id: businessId,
        platform: channel,
        is_active: true,
      },
    });

    if (!account) {
      throw new Error(`No active ${channel} account for business ${businessId}`);
    }

    if (channel === 'whatsapp') {
      return {
        phoneNumberId: account.page_id,
        accessToken: this.decryptToken(account.access_token),
      };
    }

    return {};
  }

  private decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const encryptionKey = this.configService.get<string>('encryption.key');

      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured. Please set ENCRYPTION_KEY in your .env file.');
      }

      if (!encryptedToken || !encryptedToken.includes(':')) {
        throw new Error('Invalid encrypted token format');
      }

      const key = Buffer.from(encryptionKey, 'hex');
      const parts = encryptedToken.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt token:', error);
      throw new BadRequestException('Token decryption failed. The stored token may be corrupted or the encryption key has changed.');
    }
  }
}
