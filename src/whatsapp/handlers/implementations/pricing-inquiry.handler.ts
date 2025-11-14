import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles PRICING_INQUIRY intents
 * Sends price lists and assigns to sales
 */
@Injectable()
export class PricingInquiryHandler extends BaseIntentHandler {
  constructor() {
    super(PricingInquiryHandler.name);
  }

  getIntentType(): string {
    return 'PRICING_INQUIRY';
  }

  getPriority(): number {
    return 8; // High priority
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = ['send_price_list', 'assign_to_sales'];
    const { product, category, volume } = context.entities;

    let message = 'Thanks for your interest in our pricing! ';

    if (product) {
      message += `I'll share the pricing details for ${product}. `;
      actions.push('fetch_product_pricing');
    } else if (category) {
      message += `I'll send you the pricing for our ${category} category. `;
      actions.push('fetch_category_pricing');
    } else {
      message += "I'll share our complete price list with you. ";
      actions.push('send_general_price_list');
    }

    // Volume pricing requires special handling
    if (volume && parseInt(volume) > 100) {
      message +=
        'For bulk orders, we offer special pricing. Our sales team will contact you with a custom quote.';
      actions.push('prepare_custom_quote', 'notify_sales_manager');
    } else {
      message += 'A sales representative will follow up if you have any questions.';
    }

    return this.createResponse(actions, message, false, {
      pricingRequest: { product, category, volume },
      requiresCustomQuote: volume && parseInt(volume) > 100,
    });
  }
}
