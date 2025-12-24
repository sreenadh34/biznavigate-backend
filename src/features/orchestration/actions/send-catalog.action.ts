import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';
import { SendMessageAction } from './send-message.action';

@Injectable()
export class SendCatalogAction implements ActionHandler {
  readonly type = 'send_catalog';
  private readonly logger = new Logger(SendCatalogAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendMessageAction: SendMessageAction,
  ) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const {
      categorySlug,
      headerText,
      bodyText,
      footerText,
      catalogId, // Optional: WhatsApp catalog ID
    } = params;

    this.logger.log(`Sending catalog for category: ${categorySlug}`);

    // Get category details
    const category = await this.prisma.product_categories.findFirst({
      where: {
        slug: categorySlug,
        business_id: context.businessId,
        is_active: true,
      },
    });

    if (!category) {
      this.logger.warn(`Category ${categorySlug} not found`);
      // Send fallback message
      return await this.sendMessageAction.execute({
        content: {
          type: 'TEXT',
          text: {
            body: 'Sorry, this category is not available at the moment. Please try another category.',
          },
        },
      }, context);
    }

    // Fetch products in this category that are in WhatsApp catalog
    const products = await this.prisma.products.findMany({
      where: {
        business_id: context.businessId,
        category_id: category.category_id,
        is_active: true,
        in_whatsapp_catalog: true,
      },
      include: {
        product_images: {
          where: { is_primary: true },
          take: 1,
        },
      },
      take: 30, // WhatsApp limit for product list
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      // No products in catalog for this category
      return await this.sendMessageAction.execute({
        content: {
          type: 'TEXT',
          text: {
            body: `Sorry, no products are currently available in ${category.name}. Please check other categories or contact us for assistance.`,
          },
        },
      }, context);
    }

    // Format products for WhatsApp product list message
    const productSections = [{
      title: category.name,
      product_items: products.slice(0, 30).map(product => ({
        product_retailer_id: product.product_id, // Your internal product ID
      })),
    }];

    const content = {
      type: 'INTERACTIVE',
      interactive_type: 'product_list',
      header: headerText ? {
        type: 'text',
        text: headerText,
      } : undefined,
      body: {
        text: bodyText || `🛍️ *${category.name}*\n\nBrowse our ${products.length} products in this category. Tap on any product to see details.`,
      },
      footer: footerText ? {
        text: footerText,
      } : undefined,
      action: {
        catalog_id: catalogId || context.channelConfig?.catalogId || undefined,
        sections: productSections,
      },
    };

    // Send the catalog message
    await this.sendMessageAction.execute({ content }, context);

    this.logger.log(`Sent catalog with ${products.length} products from ${category.name}`);

    return {
      success: true,
      category: category.name,
      productCount: products.length,
    };
  }
}
