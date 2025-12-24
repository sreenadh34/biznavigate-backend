import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';
import { SendMessageAction } from './send-message.action';

@Injectable()
export class FetchCategoriesAction implements ActionHandler {
  readonly type = 'fetch_categories';
  private readonly logger = new Logger(FetchCategoriesAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendMessageAction: SendMessageAction,
  ) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { businessId, format = 'whatsapp_list', sendMessage = true } = params;

    this.logger.log(`Fetching categories for business ${businessId || context.businessId}`);

    // Fetch active categories from database
    const categories = await this.prisma.product_categories.findMany({
      where: {
        business_id: businessId || context.businessId,
        is_active: true,
      },
      select: {
        category_id: true,
        name: true,
        description: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });

    if (format === 'whatsapp_list') {
      // Format categories for WhatsApp list message
      const content = {
        type: 'INTERACTIVE',
        interactive_type: 'list',
        body: {
          text: params.bodyText || '🛍️ *Browse Our Products*\n\nSelect a category to view products:',
        },
        action: {
          button: params.buttonText || 'View Categories',
          sections: [
            {
              title: 'Product Categories',
              rows: [
                {
                  id: 'all_products',
                  title: '📦 All Products',
                  description: 'View all available products',
                },
                ...categories.map(cat => ({
                  id: cat.slug,
                  title: `${this.getCategoryEmoji(cat.name)} ${cat.name}`,
                  description: cat.description || `Browse ${cat.name}`,
                })),
              ],
            },
          ],
        },
      };

      // Send message if requested
      if (sendMessage) {
        await this.sendMessageAction.execute({ content }, context);
      }

      return content;
    }

    // Return raw categories
    return categories;
  }

  private getCategoryEmoji(categoryName: string): string {
    const emojiMap: Record<string, string> = {
      electronics: '💻',
      computers: '🖥️',
      monitors: '🖥️',
      furniture: '🪑',
      desks: '🪑',
      'office chairs': '💺',
      accessories: '⌨️',
      clothing: '👕',
      home: '🏠',
    };

    const key = categoryName.toLowerCase();
    return emojiMap[key] || '📁';
  }
}
