import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import {
  IntentContext,
  IntentHandlerResult,
} from '../intent-handler.interface';

/**
 * Handles GENERAL_INQUIRY intents
 * Processes general questions about products, services, business info, etc.
 */
@Injectable()
export class GeneralInquiryHandler extends BaseIntentHandler {
  constructor() {
    super(GeneralInquiryHandler.name);
  }

  getIntentType(): string {
    return 'GENERAL_INQUIRY';
  }

  getPriority(): number {
    return 5; // Medium priority - general questions are common but not urgent
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    const actions: string[] = ['log_inquiry'];
    const { category, topic, specificQuestion } = context.entities;

    // Determine inquiry category and actions
    const inquiryCategory = this.determineInquiryCategory(context);
    let message = this.generateResponseMessage(inquiryCategory, context);

    // Add actions based on inquiry type and confidence
    switch (inquiryCategory) {
      case 'product_information':
        actions.push('send_product_catalog', 'track_product_interest');
        if (context.confidence > this.HIGH_CONFIDENCE) {
          message += ' I can share our product catalog with you.';
        } else {
          message += ' Our team can provide detailed product information.';
          actions.push('assign_to_support');
        }
        break;

      case 'service_information':
        actions.push('send_service_details', 'track_service_interest');
        if (context.confidence > this.HIGH_CONFIDENCE) {
          message += ' Let me share information about our services.';
        } else {
          message += ' Our team will provide comprehensive service details.';
          actions.push('assign_to_support');
        }
        break;

      case 'business_hours':
        actions.push('send_business_hours');
        message += ' Our business hours are typically available on our website.';
        if (context.confidence <= this.HIGH_CONFIDENCE) {
          actions.push('assign_to_support');
        }
        break;

      case 'location_store':
        actions.push('send_location_details', 'send_store_locator');
        message += ' I can help you find our nearest location.';
        break;

      case 'contact_information':
        actions.push('send_contact_details');
        message += ' Here are our contact details for further assistance.';
        break;

      case 'return_policy':
        actions.push('send_return_policy', 'send_terms_conditions');
        message += ' Let me share our return policy with you.';
        if (context.confidence <= this.HIGH_CONFIDENCE) {
          actions.push('assign_to_support');
        }
        break;

      case 'shipping_delivery':
        actions.push('send_shipping_info', 'check_delivery_zones');
        message += ' I can provide information about our shipping and delivery options.';
        break;

      case 'payment_methods':
        actions.push('send_payment_options');
        message += ' We accept various payment methods. Let me share the details.';
        break;

      case 'warranty_guarantee':
        actions.push('send_warranty_info');
        message += ' Here is information about our warranty and guarantee policies.';
        break;

      case 'technical_specifications':
        actions.push('send_technical_specs', 'assign_to_technical_team');
        message += ' Our technical team can provide detailed specifications.';
        break;

      case 'comparison_request':
        actions.push('prepare_comparison', 'assign_to_sales');
        message +=
          ' Let me prepare a comparison for you. A sales representative will assist you.';
        break;

      case 'general_question':
      default:
        actions.push('assign_to_support', 'send_faq');
        if (context.confidence > this.MIN_CONFIDENCE) {
          message += ' Our support team will assist you with your question.';
        } else {
          message +=
            ' Thank you for reaching out. Our team will review your inquiry and respond shortly.';
          actions.push('flag_for_review');
        }
        break;
    }

    // If question is urgent or time-sensitive
    if (this.isUrgent(context)) {
      actions.push('priority_high', 'notify_support_team');
      message += ' We will prioritize your inquiry.';
    }

    // Add follow-up actions
    actions.push('schedule_followup', 'track_customer_interest');

    return this.createResponse(
      actions,
      message,
      context.confidence <= this.HIGH_CONFIDENCE,
      {
        inquiryCategory,
        topic: topic || 'general',
        requiresHumanResponse: context.confidence <= this.HIGH_CONFIDENCE,
        estimatedResponseTime: this.getEstimatedResponseTime(inquiryCategory),
      }
    );
  }

  /**
   * Determine the category of inquiry based on context
   */
  private determineInquiryCategory(context: IntentContext): string {
    const message = context.originalMessage?.toLowerCase() || '';
    const { category, topic } = context.entities;

    // Use AI-provided category if available
    if (category) {
      return category;
    }

    // Keyword-based categorization
    if (
      message.includes('product') ||
      message.includes('item') ||
      message.includes('catalog')
    ) {
      return 'product_information';
    }

    if (
      message.includes('service') ||
      message.includes('offering') ||
      message.includes('what do you do')
    ) {
      return 'service_information';
    }

    if (
      message.includes('hours') ||
      message.includes('open') ||
      message.includes('close') ||
      message.includes('timing')
    ) {
      return 'business_hours';
    }

    if (
      message.includes('location') ||
      message.includes('address') ||
      message.includes('where') ||
      message.includes('store')
    ) {
      return 'location_store';
    }

    if (
      message.includes('contact') ||
      message.includes('phone') ||
      message.includes('email') ||
      message.includes('reach')
    ) {
      return 'contact_information';
    }

    if (
      message.includes('return') ||
      message.includes('refund') ||
      message.includes('exchange')
    ) {
      return 'return_policy';
    }

    if (
      message.includes('shipping') ||
      message.includes('delivery') ||
      message.includes('courier')
    ) {
      return 'shipping_delivery';
    }

    if (
      message.includes('payment') ||
      message.includes('pay') ||
      message.includes('credit card') ||
      message.includes('cash')
    ) {
      return 'payment_methods';
    }

    if (
      message.includes('warranty') ||
      message.includes('guarantee') ||
      message.includes('coverage')
    ) {
      return 'warranty_guarantee';
    }

    if (
      message.includes('specification') ||
      message.includes('specs') ||
      message.includes('technical') ||
      message.includes('features')
    ) {
      return 'technical_specifications';
    }

    if (
      message.includes('compare') ||
      message.includes('difference') ||
      message.includes('versus') ||
      message.includes('vs')
    ) {
      return 'comparison_request';
    }

    return 'general_question';
  }

  /**
   * Generate appropriate response message based on inquiry category
   */
  private generateResponseMessage(
    category: string,
    context: IntentContext
  ): string {
    const baseMessages: Record<string, string> = {
      product_information:
        'Thank you for your interest in our products!',
      service_information:
        'Thank you for inquiring about our services!',
      business_hours:
        'Thanks for asking about our business hours.',
      location_store:
        'Let me help you find our location.',
      contact_information:
        'I appreciate you reaching out to us.',
      return_policy:
        'Thank you for inquiring about our return policy.',
      shipping_delivery:
        'I can help you with shipping and delivery information.',
      payment_methods:
        'Thanks for asking about payment options.',
      warranty_guarantee:
        'Let me provide information about our warranty.',
      technical_specifications:
        'Thank you for your interest in technical details.',
      comparison_request:
        'I can help you compare our offerings.',
      general_question:
        'Thank you for your inquiry!',
    };

    return baseMessages[category] || baseMessages.general_question;
  }

  /**
   * Check if inquiry is urgent based on message content
   */
  private isUrgent(context: IntentContext): boolean {
    const message = context.originalMessage?.toLowerCase() || '';
    const { urgency } = context.entities;

    if (urgency === 'urgent' || urgency === 'asap' || urgency === 'immediate') {
      return true;
    }

    const urgentKeywords = [
      'urgent',
      'asap',
      'immediately',
      'emergency',
      'right now',
      'today',
      'quickly',
    ];

    return urgentKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Get estimated response time based on inquiry category
   */
  private getEstimatedResponseTime(category: string): string {
    const responseTimes: Record<string, string> = {
      product_information: '15-30 minutes',
      service_information: '15-30 minutes',
      business_hours: 'immediate',
      location_store: 'immediate',
      contact_information: 'immediate',
      return_policy: '30-60 minutes',
      shipping_delivery: '15-30 minutes',
      payment_methods: 'immediate',
      warranty_guarantee: '30-60 minutes',
      technical_specifications: '1-2 hours',
      comparison_request: '1-2 hours',
      general_question: '30-60 minutes',
    };

    return responseTimes[category] || '30-60 minutes';
  }
}
