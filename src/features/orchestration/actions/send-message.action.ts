import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppApiClientService } from '../../whatsapp/infrastructure/whatsapp-api-client.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';

/**
 * Send Message Action - Channel-agnostic message sending
 * Delegates to appropriate channel service based on context
 */
@Injectable()
export class SendMessageAction implements ActionHandler {
  readonly type = 'send_message';

  private readonly logger = new Logger(SendMessageAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappApiClient: WhatsAppApiClientService,
  ) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { content } = params;
    const { channel, channelConfig, leadId, conversationId, businessId, tenantId } = context;

    this.logger.log(
      `Sending message via ${channel} to lead ${leadId}`,
    );

    // Process template variables in content
    const processedContent = this.processTemplates(content, context);

    // Get recipient (lead's platform_user_id)
    const lead = await this.prisma.leads.findUnique({
      where: { lead_id: leadId },
      select: { platform_user_id: true },
    });

    if (!lead?.platform_user_id) {
      throw new Error(`Lead ${leadId} has no platform_user_id`);
    }

    const recipient = lead.platform_user_id;

    // Route to appropriate channel
    let result: any;

    switch (channel) {
      case 'whatsapp':
        result = await this.sendViaWhatsApp(recipient, processedContent, channelConfig);
        break;

      case 'instagram':
        // TODO: Implement Instagram sending
        throw new Error('Instagram channel not yet implemented');

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }

    // Save outgoing message to database
    if (conversationId) {
      await this.prisma.lead_messages.create({
        data: {
          conversation_id: conversationId,
          lead_id: leadId,
          business_id: businessId,
          tenant_id: tenantId,
          sender_type: 'business',
          message_text: processedContent.text || processedContent.body?.text || 'Interactive message',
          message_type: processedContent.type?.toLowerCase() || 'text',
          platform_message_id: result.messageId,
          delivery_status: result.status || 'sent',
          is_automated: true,
        },
      });
    }

    return result;
  }

  /**
   * Process template variables in content
   * Replaces {{ context.* }} with actual values
   */
  private processTemplates(content: any, context: WorkflowExecutionContext): any {
    const processString = (str: string): string => {
      if (!str || typeof str !== 'string') return str;

      // Replace {{ context.* }} patterns
      return str.replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (match, key) => {
        const value = (context as any)[key];
        return value !== undefined ? String(value) : match;
      });
    };

    // Deep clone and process the content
    const processed = JSON.parse(JSON.stringify(content));

    // Process text fields
    if (processed.text) {
      processed.text = processString(processed.text);
    }
    if (processed.body?.text) {
      processed.body.text = processString(processed.body.text);
    }
    if (processed.header?.text) {
      processed.header.text = processString(processed.header.text);
    }
    if (processed.footer?.text) {
      processed.footer.text = processString(processed.footer.text);
    }

    // Process button titles
    if (processed.action?.buttons) {
      processed.action.buttons = processed.action.buttons.map((btn: any) => ({
        ...btn,
        reply: {
          ...btn.reply,
          title: processString(btn.reply?.title || btn.title || ''),
        },
      }));
    }

    return processed;
  }

  /**
   * Send message via WhatsApp
   */
  private async sendViaWhatsApp(
    recipient: string,
    content: any,
    config: { phoneNumberId: string; accessToken: string },
  ): Promise<{ messageId: string; status: string }> {
    // Convert to WhatsApp format
    const whatsappMessage: any = {
      messaging_product: 'whatsapp',
      to: recipient,
    };

    // Handle different content types
    if (content.type === 'TEXT' || !content.type) {
      whatsappMessage.type = 'text';
      whatsappMessage.text = {
        body: content.text,
        preview_url: content.preview_url || false,
      };
    } else if (content.type === 'INTERACTIVE') {
      // Interactive message with buttons
      whatsappMessage.type = 'interactive';
      whatsappMessage.interactive = {
        type: content.interactive_type || 'button',
        body: {
          text: content.body?.text || content.text || '',
        },
      };

      // Add header if provided
      if (content.header?.text) {
        whatsappMessage.interactive.header = {
          type: 'text',
          text: content.header.text,
        };
      }

      // Add footer if provided
      if (content.footer?.text) {
        whatsappMessage.interactive.footer = {
          text: content.footer.text,
        };
      }

      // Add action buttons or list
      if (content.action?.buttons) {
        whatsappMessage.interactive.action = {
          buttons: content.action.buttons.map((btn: any, idx: number) => ({
            type: 'reply',
            reply: {
              id: btn.reply?.id || btn.id || `btn_${idx}`,
              title: btn.reply?.title || btn.title || `Option ${idx + 1}`,
            },
          })),
        };
      } else if (content.action?.sections) {
        // List message (supports up to 10 options)
        whatsappMessage.interactive.action = {
          button: content.action.button || 'View Options',
          sections: content.action.sections,
        };
      }
    } else {
      // TODO: Handle other types (media, etc.)
      throw new Error(`Unsupported WhatsApp message type: ${content.type}`);
    }

    // Send via WhatsApp API
    const response = await this.whatsappApiClient.sendMessage(
      config.phoneNumberId,
      config.accessToken,
      whatsappMessage,
    );

    return {
      messageId: response.messages[0].id,
      status: 'sent',
    };
  }
}
