import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';
import { SendMessageAction } from './send-message.action';

@Injectable()
export class FetchProductsAction implements ActionHandler {
  readonly type = 'fetch_products';
  private readonly logger = new Logger(FetchProductsAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendMessageAction: SendMessageAction,
  ) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { categorySlug, businessId, sendMessage = true } = params;

    this.logger.log(`Fetching products for category ${categorySlug} in business ${businessId || context.businessId}`);

    // Build where clause
    const where: any = {
      business_id: businessId || context.businessId,
      is_active: true,
      in_whatsapp_catalog: true,
    };

    // If category specified, filter by category
    if (categorySlug && categorySlug !== 'all_products') {
      // Find category by slug
      const category = await this.prisma.product_categories.findFirst({
        where: {
          slug: categorySlug,
          business_id: businessId || context.businessId,
          is_active: true,
        },
      });

      if (category) {
        where.category_id = category.category_id;
      }
    }

    // Fetch products
    const products = await this.prisma.products.findMany({
      where,
      select: {
        product_id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        in_stock: true,
        primary_image_url: true,
        product_categories: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 10, // Limit to 10 products for WhatsApp list
    });

    if (products.length === 0) {
      // No products found
      const content = {
        type: 'TEXT',
        text: '😔 Sorry, no products found in this category at the moment.',
      };

      if (sendMessage) {
        await this.sendMessageAction.execute({ content }, context);
      }

      return { products: [], message: 'No products found' };
    }

    // Format products for WhatsApp list message
    const categoryName = categorySlug === 'all_products' ? 'All Products' : products[0]?.product_categories?.name || 'Products';

    const content = {
      type: 'INTERACTIVE',
      interactive_type: 'list',
      body: {
        text: `🛍️ *${categoryName}*\n\n${products.length} product${products.length > 1 ? 's' : ''} available. Tap to view details:`,
      },
      action: {
        button: 'View Products',
        sections: [
          {
            title: categoryName,
            rows: products.map(product => ({
              id: product.product_id,
              title: product.name.length > 24 ? product.name.substring(0, 21) + '...' : product.name,
              description: `${product.currency} ${product.price} ${product.in_stock ? '✅' : '❌ Out of stock'}`,
            })),
          },
        ],
      },
    };

    if (sendMessage) {
      await this.sendMessageAction.execute({ content }, context);
    }

    return { products, content };
  }
}
