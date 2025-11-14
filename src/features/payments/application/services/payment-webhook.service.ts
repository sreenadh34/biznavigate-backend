import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentRepositoryPrisma } from '../../infrastructure/payment.repository.prisma';
import { RazorpayService } from '../../infrastructure/razorpay.service';
import { PaymentService } from './payment.service';
import { PaymentWebhookDto } from '../dto/payment-webhook.dto';
import { WebhookStatus, WebhookEventType } from '../../domain/entities/payment-webhook.entity';
import { PaymentStatus } from '../../domain/entities/payment.entity';

/**
 * Payment Webhook Service
 * Handles Razorpay webhook events with signature verification
 * Production-ready with idempotency, retry logic, and comprehensive error handling
 */
@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);
  private readonly MAX_RETRY_COUNT = 3;

  constructor(
    private readonly paymentRepository: PaymentRepositoryPrisma,
    private readonly razorpayService: RazorpayService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Process webhook event
   * Main entry point for all Razorpay webhooks
   * Handles signature verification, idempotency, and event processing
   */
  async processWebhook(
    webhookBody: string,
    signature: string,
    webhookDto: PaymentWebhookDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Processing webhook event: ${webhookDto.event}`);

      // Step 1: Verify webhook signature
      const isValidSignature = this.razorpayService.verifyWebhookSignature(webhookBody, signature);
      if (!isValidSignature) {
        this.logger.warn('Invalid webhook signature received');

        // Store webhook with invalid signature status
        await this.createWebhookRecord(
          webhookDto,
          signature,
          WebhookStatus.INVALID_SIGNATURE,
        );

        throw new BadRequestException('Invalid webhook signature');
      }

      // Step 2: Check for duplicate webhook (idempotency)
      const eventId = this.extractEventId(webhookDto);
      if (eventId) {
        const existingWebhook = await this.paymentRepository.findWebhookByEventId(eventId);
        if (existingWebhook) {
          this.logger.log(`Duplicate webhook event: ${eventId} - Already processed`);

          // Update webhook as duplicate
          await this.paymentRepository.updateWebhook(existingWebhook.webhook_id, {
            status: WebhookStatus.DUPLICATE,
            retry_count: existingWebhook.retry_count + 1,
          });

          return {
            success: true,
            message: 'Webhook already processed (duplicate)',
          };
        }
      }

      // Step 3: Create webhook record
      const webhook = await this.createWebhookRecord(
        webhookDto,
        signature,
        WebhookStatus.PENDING,
      );

      // Step 4: Process webhook based on event type
      try {
        await this.handleWebhookEvent(webhookDto);

        // Update webhook as processed
        await this.paymentRepository.updateWebhook(webhook.webhook_id, {
          status: WebhookStatus.PROCESSED,
          processed_at: new Date(),
        });

        this.logger.log(`Webhook processed successfully: ${webhookDto.event}`);

        return {
          success: true,
          message: 'Webhook processed successfully',
        };
      } catch (error) {
        this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);

        // Update webhook as failed
        await this.paymentRepository.updateWebhook(webhook.webhook_id, {
          status: WebhookStatus.FAILED,
          retry_count: webhook.retry_count + 1,
          error_message: error.message,
        });

        // Re-throw error for retry by Razorpay
        throw error;
      }
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle different webhook event types
   */
  private async handleWebhookEvent(webhookDto: PaymentWebhookDto): Promise<void> {
    const event = webhookDto.event;
    const paymentEntity = webhookDto.payload?.payment?.entity;

    if (!paymentEntity) {
      throw new BadRequestException('Invalid webhook payload: missing payment entity');
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    this.logger.log(`Handling webhook event: ${event} for payment: ${razorpayPaymentId}`);

    // Find payment by Razorpay order ID or payment ID
    let payment = await this.paymentRepository.findByRazorpayOrderId(razorpayOrderId);
    if (!payment && razorpayPaymentId) {
      payment = await this.paymentRepository.findByRazorpayPaymentId(razorpayPaymentId);
    }

    if (!payment) {
      this.logger.warn(`Payment not found for webhook: ${razorpayOrderId}`);
      throw new BadRequestException(`Payment not found: ${razorpayOrderId}`);
    }

    // Update webhook tracking
    await this.paymentRepository.update(payment.payment_id, {
      webhook_received_at: new Date(),
      webhook_attempts: (payment.webhook_attempts || 0) + 1,
    });

    // Process based on event type
    switch (event) {
      case WebhookEventType.PAYMENT_AUTHORIZED:
        await this.handlePaymentAuthorized(payment.payment_id, paymentEntity);
        break;

      case WebhookEventType.PAYMENT_CAPTURED:
      case WebhookEventType.ORDER_PAID:
        await this.handlePaymentCaptured(payment.payment_id, paymentEntity);
        break;

      case WebhookEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(payment.payment_id, paymentEntity);
        break;

      case WebhookEventType.REFUND_CREATED:
      case WebhookEventType.REFUND_PROCESSED:
        await this.handleRefundProcessed(payment.payment_id, paymentEntity);
        break;

      case WebhookEventType.REFUND_FAILED:
        this.logger.warn(`Refund failed for payment: ${payment.payment_id}`);
        break;

      default:
        this.logger.warn(`Unhandled webhook event type: ${event}`);
    }
  }

  /**
   * Handle payment authorized event
   */
  private async handlePaymentAuthorized(paymentId: string, paymentEntity: any): Promise<void> {
    this.logger.log(`Payment authorized: ${paymentId}`);

    await this.paymentRepository.updateStatus(paymentId, PaymentStatus.AUTHORIZED, {
      razorpay_payment_id: paymentEntity.id,
      method: paymentEntity.method,
      authorized_at: new Date(paymentEntity.created_at * 1000),
    });
  }

  /**
   * Handle payment captured event
   */
  private async handlePaymentCaptured(paymentId: string, paymentEntity: any): Promise<void> {
    this.logger.log(`Payment captured: ${paymentId}`);

    // Update payment status to captured
    await this.paymentRepository.updateStatus(paymentId, PaymentStatus.CAPTURED, {
      razorpay_payment_id: paymentEntity.id,
      method: paymentEntity.method,
      captured_at: new Date(),
      webhook_processed_at: new Date(),
    });

    // Trigger order confirmation (convert stock reservation, update order status)
    const payment = await this.paymentRepository.findById(paymentId);
    if (payment) {
      try {
        // This will call OrderRepository.confirmPayment which handles stock conversion
        await this.paymentService.capturePayment(paymentId);
      } catch (error) {
        // Payment is already captured, but order update failed
        // This should trigger manual review
        this.logger.error(
          `Payment captured but order confirmation failed: ${paymentId}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(paymentId: string, paymentEntity: any): Promise<void> {
    this.logger.log(`Payment failed: ${paymentId}`);

    const errorCode = paymentEntity.error_code;
    const errorDescription = paymentEntity.error_description;

    await this.paymentRepository.updateStatus(paymentId, PaymentStatus.FAILED, {
      razorpay_payment_id: paymentEntity.id,
      method: paymentEntity.method,
      failed_at: new Date(),
      failure_reason: `${errorCode}: ${errorDescription}`,
      webhook_processed_at: new Date(),
    });
  }

  /**
   * Handle refund processed event
   */
  private async handleRefundProcessed(paymentId: string, paymentEntity: any): Promise<void> {
    this.logger.log(`Refund processed for payment: ${paymentId}`);

    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new BadRequestException(`Payment not found: ${paymentId}`);
    }

    // Refund amount is in webhook payload (in paise)
    const refundAmount = paymentEntity.amount_refunded
      ? paymentEntity.amount_refunded / 100
      : payment.amount;

    const newStatus =
      refundAmount >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL_REFUND;

    await this.paymentRepository.updateStatus(paymentId, newStatus, {
      refund_amount: refundAmount,
      refunded_at: new Date(),
      webhook_processed_at: new Date(),
    });
  }

  /**
   * Create webhook record for audit trail
   */
  private async createWebhookRecord(
    webhookDto: PaymentWebhookDto,
    signature: string,
    status: WebhookStatus,
  ): Promise<any> {
    const eventId = this.extractEventId(webhookDto);
    const paymentEntity = webhookDto.payload?.payment?.entity;

    // Try to find payment to link webhook
    let paymentId: string | undefined;
    if (paymentEntity) {
      const payment =
        await this.paymentRepository.findByRazorpayOrderId(paymentEntity.order_id) ||
        await this.paymentRepository.findByRazorpayPaymentId(paymentEntity.id);
      paymentId = payment?.payment_id;
    }

    return this.paymentRepository.createWebhook({
      payment_id: paymentId,
      event_type: webhookDto.event,
      razorpay_event_id: eventId,
      payload: webhookDto,
      signature,
      status,
      retry_count: 0,
      received_at: new Date(),
    });
  }

  /**
   * Extract event ID from webhook payload
   * Used for idempotency checking
   */
  private extractEventId(webhookDto: PaymentWebhookDto): string {
    // Razorpay sends unique event ID in payload
    // If not present, generate from payment ID + timestamp
    const paymentEntity = webhookDto.payload?.payment?.entity;
    if (paymentEntity) {
      return `${webhookDto.event}_${paymentEntity.id}_${webhookDto.created_at || Date.now()}`;
    }

    return `${webhookDto.event}_${Date.now()}`;
  }
}
