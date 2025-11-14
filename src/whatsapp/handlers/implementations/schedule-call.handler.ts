import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles SCHEDULE_CALL intents
 * Creates calendar events and sends confirmations
 */
@Injectable()
export class ScheduleCallHandler extends BaseIntentHandler {
  constructor() {
    super(ScheduleCallHandler.name);
  }

  getIntentType(): string {
    return 'SCHEDULE_CALL';
  }

  getPriority(): number {
    return 6;
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = ['check_calendar_availability', 'assign_to_sales'];
    const { preferredDate, preferredTime, purpose, urgency } = context.entities;

    let message = "I'd be happy to schedule a call with you! ";

    if (preferredDate || preferredTime) {
      const timeInfo = [preferredDate, preferredTime].filter(Boolean).join(' at ');
      message += `I see you'd prefer ${timeInfo}. `;
      actions.push('validate_time_slot', 'check_agent_availability');

      if (context.confidence > this.HIGH_CONFIDENCE) {
        message += 'Let me check availability and send you a confirmation.';
        actions.push('create_calendar_event', 'send_calendar_invite');
      } else {
        message +=
          'Our team will confirm this time slot with you shortly and send a calendar invite.';
        actions.push('request_time_confirmation');
      }
    } else {
      message +=
        "Our team will reach out to find a convenient time for you. Please let us know your availability.";
      actions.push('send_availability_form', 'notify_scheduling_team');
    }

    // Urgent calls get priority
    if (urgency === 'urgent' || urgency === 'asap') {
      actions.push('priority_high', 'find_immediate_slot');
      message += ' We will prioritize scheduling this as soon as possible.';
    }

    return this.createResponse(
      actions,
      message,
      context.confidence <= this.HIGH_CONFIDENCE,
      {
        schedulingRequest: { preferredDate, preferredTime, purpose, urgency },
        requiresConfirmation: !preferredDate && !preferredTime,
      }
    );
  }
}
