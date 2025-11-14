// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

/**
 * Razorpay Service
 * Wrapper around Razorpay SDK for production-ready payment processing
 * Handles order creation, signature verification, refunds, and webhook validation
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpayInstance: Razorpay;
  private webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
    }

    this.razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.logger.log('Razorpay service initialized');
  }

  /**
   * Create a Razorpay order
   * This is step 1 of the payment flow
   * Returns razorpay_order_id needed for checkout
   */
  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt?: string,
    notes?: Record<string, any>,
  ): Promise<RazorpayOrderResponse> {
    try {
      // Razorpay expects amount in paise (1 rupee = 100 paise)
      const amountInPaise = Math.round(amount * 100);

      const orderOptions = {
        amount: amountInPaise,
        currency,
        receipt: receipt || `order_${Date.now()}`,
        notes: notes || {},
      };

      this.logger.log(`Creating Razorpay order: ${JSON.stringify(orderOptions)}`);

      const order = await this.razorpayInstance.orders.create(orderOptions);

      this.logger.log(`Razorpay order created: ${order.id}`);

      return {
        id: order.id,
        entity: order.entity,
        amount: order.amount,
        amount_paid: order.amount_paid,
        amount_due: order.amount_due,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        attempts: order.attempts,
        notes: order.notes,
        created_at: order.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to create Razorpay order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify payment signature
   * Called after customer completes payment on frontend
   * Validates that the payment came from Razorpay (prevents tampering)
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): boolean {
    try {
      const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

      // Create expected signature: HMAC SHA256 of order_id|payment_id with key_secret
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const isValid = generatedSignature === razorpaySignature;

      if (isValid) {
        this.logger.log(`Payment signature verified: ${razorpayPaymentId}`);
      } else {
        this.logger.warn(`Invalid payment signature for payment: ${razorpayPaymentId}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to verify payment signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Verify webhook signature
   * Validates that webhook came from Razorpay
   * Critical for security - prevents fake webhook attacks
   */
  verifyWebhookSignature(webhookBody: string, receivedSignature: string): boolean {
    try {
      if (!this.webhookSecret) {
        this.logger.error('Webhook secret not configured');
        return false;
      }

      // Generate expected signature using webhook secret
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(webhookBody)
        .digest('hex');

      const isValid = expectedSignature === receivedSignature;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature received');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   * Useful for manual verification and reconciliation
   */
  async fetchPayment(paymentId: string): Promise<any> {
    try {
      this.logger.log(`Fetching payment details: ${paymentId}`);
      const payment = await this.razorpayInstance.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      this.logger.error(`Failed to fetch payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Capture a payment
   * Required for 2-step payments (authorize then capture)
   * Most merchants use auto-capture, but this is for manual capture flows
   */
  async capturePayment(paymentId: string, amount: number, currency: string = 'INR'): Promise<any> {
    try {
      const amountInPaise = Math.round(amount * 100);

      this.logger.log(`Capturing payment: ${paymentId} for ₹${amount}`);

      const payment = await this.razorpayInstance.payments.capture(paymentId, amountInPaise, currency);

      this.logger.log(`Payment captured: ${paymentId}`);

      return payment;
    } catch (error) {
      this.logger.error(`Failed to capture payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a refund
   * Supports both full and partial refunds
   */
  async createRefund(
    paymentId: string,
    amount?: number,
    notes?: Record<string, any>,
  ): Promise<RazorpayRefundResponse> {
    try {
      const refundOptions: any = {
        notes: notes || {},
      };

      // If amount specified, do partial refund
      if (amount !== undefined) {
        refundOptions.amount = Math.round(amount * 100); // Convert to paise
        this.logger.log(`Creating partial refund for payment ${paymentId}: ₹${amount}`);
      } else {
        this.logger.log(`Creating full refund for payment ${paymentId}`);
      }

      const refund = await this.razorpayInstance.payments.refund(paymentId, refundOptions);

      this.logger.log(`Refund created: ${refund.id}`);

      return {
        id: refund.id,
        entity: refund.entity,
        amount: refund.amount,
        currency: refund.currency,
        payment_id: refund.payment_id,
        notes: refund.notes,
        receipt: refund.receipt,
        status: refund.status,
        speed_requested: refund.speed_requested,
        speed_processed: refund.speed_processed,
        created_at: refund.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Fetch all payments for an order
   * Useful for tracking multiple payment attempts
   */
  async fetchOrderPayments(orderId: string): Promise<any[]> {
    try {
      this.logger.log(`Fetching payments for order: ${orderId}`);
      const payments = await this.razorpayInstance.orders.fetchPayments(orderId);
      return payments.items || [];
    } catch (error) {
      this.logger.error(`Failed to fetch order payments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Fetch settlement details
   * Used for daily reconciliation
   */
  async fetchSettlements(from: number, to: number): Promise<any> {
    try {
      this.logger.log(`Fetching settlements from ${from} to ${to}`);
      const settlements = await this.razorpayInstance.settlements.all({
        from,
        to,
      });
      return settlements;
    } catch (error) {
      this.logger.error(`Failed to fetch settlements: ${error.message}`, error.stack);
      throw error;
    }
  }
}

/**
 * Razorpay Order Response Interface
 */
export interface RazorpayOrderResponse {
  id: string; // order_xxxxx
  entity: string; // "order"
  amount: number; // Amount in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string; // created, attempted, paid
  attempts: number;
  notes: Record<string, any>;
  created_at: number; // Unix timestamp
}

/**
 * Razorpay Refund Response Interface
 */
export interface RazorpayRefundResponse {
  id: string; // rfnd_xxxxx
  entity: string; // "refund"
  amount: number; // Refund amount in paise
  currency: string;
  payment_id: string;
  notes?: Record<string, any>;
  receipt?: string;
  status: string; // pending, processed, failed
  speed_requested: string; // normal, optimum
  speed_processed: string;
  created_at: number; // Unix timestamp
}
