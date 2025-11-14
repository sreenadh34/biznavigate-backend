import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles AVAILABILITY_INQUIRY intents
 * Checks inventory and provides availability information
 */
@Injectable()
export class AvailabilityInquiryHandler extends BaseIntentHandler {
  constructor() {
    super(AvailabilityInquiryHandler.name);
  }

  getIntentType(): string {
    return 'AVAILABILITY_INQUIRY';
  }

  getPriority(): number {
    return 7;
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = ['check_inventory', 'send_availability_status'];
    const { product, quantity, location, date } = context.entities;

    let message = 'Let me check the availability for you. ';

    if (product) {
      message += `I'll verify the stock for ${product}`;
      actions.push('fetch_product_inventory');

      if (quantity) {
        message += ` (${quantity} units)`;
        actions.push('validate_quantity_available');
      }

      if (location) {
        message += ` at our ${location} location`;
        actions.push('check_location_specific_inventory');
      }

      message += '. ';
    }

    if (date) {
      message += `I'll also check the expected availability for ${date}. `;
      actions.push('check_future_availability');
    }

    message += "I'll get back to you in just a moment with the details.";

    // If checking future availability, might need supplier contact
    if (date && !product) {
      actions.push('notify_procurement_team');
    }

    return this.createResponse(actions, message, false, {
      availabilityRequest: { product, quantity, location, date },
      requiresInventoryCheck: true,
    });
  }
}
