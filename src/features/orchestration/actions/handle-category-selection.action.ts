import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';
import { SendCatalogAction } from './send-catalog.action';
import { FetchProductsAction } from './fetch-products.action';

/**
 * Handles category selection from interactive list
 * Routes to catalog or products based on selection
 */
@Injectable()
export class HandleCategorySelectionAction implements ActionHandler {
  readonly type = 'handle_category_selection';
  private readonly logger = new Logger(HandleCategorySelectionAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendCatalogAction: SendCatalogAction,
    private readonly fetchProductsAction: FetchProductsAction,
  ) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    // Get the selection from context (passed from AI or direct from webhook)
    const selection = context.entities?.category_slug ||
                     context.aiResult?.entities?.category_slug ||
                     params.categorySlug;

    this.logger.log(`Handling category selection: ${selection}`);

    if (!selection) {
      this.logger.warn('No category selection found in context');
      return {
        success: false,
        error: 'No category selected',
      };
    }

    // Handle "all_products" selection
    if (selection === 'all_products') {
      this.logger.log('User selected all products - fetching product list');
      return await this.fetchProductsAction.execute({
        categorySlug: 'all_products',
        format: 'whatsapp_list',
        sendMessage: true,
      }, context);
    }

    // Handle specific category selection - send catalog
    this.logger.log(`User selected category: ${selection} - sending catalog`);
    return await this.sendCatalogAction.execute({
      categorySlug: selection,
      headerText: 'Our Products',
      bodyText: 'Browse our catalog below. Tap on any product to see details.',
      footerText: 'Reply with product name or code to inquire',
    }, context);
  }
}
