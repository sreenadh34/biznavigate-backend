import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles ORDER_REQUEST intents
 * Creates orders and notifies sales team
 */
@Injectable()
export class OrderRequestHandler extends BaseIntentHandler {
  constructor() {
    super(OrderRequestHandler.name);
  }

  getIntentType(): string {
    return 'ORDER_REQUEST';
  }

  getPriority(): number {
    return 10; // High priority
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = ['create_order', 'notify_sales'];
    let message = 'Thank you for your order request! ';

    // Extract order details from entities
    const { quantity, product, urgency } = context.entities;

    if (context.confidence > this.HIGH_CONFIDENCE) {
      // High confidence - proceed with order
      if (product && quantity) {
        message += `We've received your request for ${quantity} units of ${product}. `;
        actions.push('check_inventory');
      }
      message += 'Our sales team will contact you shortly with details.';
    } else {
      // Medium confidence - need clarification
      message +=
        'We need a few more details to process your order. Our team will reach out to confirm.';
      actions.push('request_clarification');
    }

    // Urgent orders get priority
    if (urgency === 'urgent' || urgency === 'immediate') {
      actions.push('priority_high', 'notify_supervisor');
      message += ' We will prioritize this as urgent.';
    }

    return this.createResponse(
      actions,
      message,
      context.confidence <= this.HIGH_CONFIDENCE,
      {
        orderDetails: { product, quantity, urgency },
        requiresConfirmation: context.confidence <= this.HIGH_CONFIDENCE,
      }
    );
  }
}
