import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles COMPLAINT intents
 * Creates support tickets and escalates to support team
 */
@Injectable()
export class ComplaintHandler extends BaseIntentHandler {
  constructor() {
    super(ComplaintHandler.name);
  }

  getIntentType(): string {
    return 'COMPLAINT';
  }

  getPriority(): number {
    return 10; // Highest priority - customer complaints are critical
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = [
      'create_support_ticket',
      'notify_support_team',
      'priority_high',
    ];

    const { severity, category, orderId } = context.entities;

    let message = "I'm sorry to hear about this issue. ";

    // Determine severity
    const isCritical =
      severity === 'critical' ||
      severity === 'urgent' ||
      context.originalMessage.toLowerCase().includes('urgent') ||
      context.originalMessage.toLowerCase().includes('immediately');

    if (isCritical) {
      message +=
        "We're escalating this to our support team immediately. A supervisor will contact you within the next hour.";
      actions.push('notify_supervisor', 'priority_critical', 'immediate_followup');
    } else {
      message +=
        "We're creating a support ticket and our team will reach out shortly to resolve this.";
      actions.push('schedule_followup');
    }

    // If order-related, fetch order details
    if (orderId) {
      actions.push('fetch_order_details', 'notify_fulfillment_team');
      message += ` We'll review your order #${orderId} and get back to you.`;
    }

    // Add compensation consideration for critical issues
    if (isCritical) {
      actions.push('consider_compensation');
    }

    return this.createResponse(actions, message, true, {
      severity: isCritical ? 'critical' : 'normal',
      category,
      orderId,
      requiresImmediateAction: isCritical,
    });
  }
}
