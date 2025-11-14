import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Payment, PaymentStatus } from '../domain/entities/payment.entity';
import { PaymentWebhook, WebhookStatus } from '../domain/entities/payment-webhook.entity';
import { PaymentQueryDto } from '../application/dto/payment-query.dto';

/**
 * Payment Repository Interface
 * Defines contract for payment data access
 */
export interface IPaymentRepository {
  create(payment: Partial<Payment>): Promise<Payment>;
  findById(paymentId: string): Promise<Payment | null>;
  findByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null>;
  findByRazorpayPaymentId(razorpayPaymentId: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findAll(query: PaymentQueryDto): Promise<{ data: Payment[]; total: number; page: number; limit: number }>;
  update(paymentId: string, data: Partial<Payment>): Promise<Payment>;
  updateStatus(paymentId: string, status: PaymentStatus, metadata?: Partial<Payment>): Promise<Payment>;
  createWebhook(webhook: Partial<PaymentWebhook>): Promise<PaymentWebhook>;
  findWebhookByEventId(eventId: string): Promise<PaymentWebhook | null>;
  updateWebhook(webhookId: string, data: Partial<PaymentWebhook>): Promise<PaymentWebhook>;
}

/**
 * Prisma implementation of Payment Repository
 * Production-ready with proper transaction handling and error handling
 */
@Injectable()
export class PaymentRepositoryPrisma implements IPaymentRepository {
  private readonly logger = new Logger(PaymentRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new payment record
   * Uses transaction to ensure atomicity
   */
  async create(payment: Partial<Payment>): Promise<Payment> {
    try {
      const created = await this.prisma.payments.create({
        data: {
          business_id: payment.business_id,
          tenant_id: payment.tenant_id,
          order_id: payment.order_id,
          customer_id: payment.customer_id,
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
          amount: payment.amount,
          currency: payment.currency || 'INR',
          status: payment.status || PaymentStatus.CREATED,
          method: payment.method,
          webhook_attempts: payment.webhook_attempts || 0,
          refund_amount: payment.refund_amount || 0,
        } as any,
      });

      this.logger.log(`Payment created: ${created.payment_id} - ${created.razorpay_order_id}`);
      return this.toDomainPayment(created);
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find payment by internal ID
   */
  async findById(paymentId: string): Promise<Payment | null> {
    try {
      const payment = await this.prisma.payments.findUnique({
        where: { payment_id: paymentId },
      });

      return payment ? this.toDomainPayment(payment) : null;
    } catch (error) {
      this.logger.error(`Failed to find payment by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find payment by Razorpay order ID
   * Important for linking Razorpay orders to our payments
   */
  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    try {
      const payment = await this.prisma.payments.findUnique({
        where: { razorpay_order_id: razorpayOrderId },
      });

      return payment ? this.toDomainPayment(payment) : null;
    } catch (error) {
      this.logger.error(`Failed to find payment by Razorpay order ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find payment by Razorpay payment ID
   * Used when processing webhooks
   */
  async findByRazorpayPaymentId(razorpayPaymentId: string): Promise<Payment | null> {
    try {
      const payment = await this.prisma.payments.findUnique({
        where: { razorpay_payment_id: razorpayPaymentId },
      });

      return payment ? this.toDomainPayment(payment) : null;
    } catch (error) {
      this.logger.error(`Failed to find payment by Razorpay payment ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find payment by order ID
   * One order can have one payment
   */
  async findByOrderId(orderId: string): Promise<Payment | null> {
    try {
      const payment = await this.prisma.payments.findFirst({
        where: { order_id: orderId },
        orderBy: { created_at: 'desc' },
      });

      return payment ? this.toDomainPayment(payment) : null;
    } catch (error) {
      this.logger.error(`Failed to find payment by order ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all payments with filtering, pagination, and sorting
   */
  async findAll(
    query: PaymentQueryDto,
  ): Promise<{ data: Payment[]; total: number; page: number; limit: number }> {
    try {
      const {
        business_id,
        customer_id,
        order_id,
        status,
        method,
        razorpay_payment_id,
        razorpay_order_id,
        from_date,
        to_date,
        min_amount,
        max_amount,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        order = 'desc',
      } = query;

      // Build where clause
      const where: any = {};

      if (business_id) {
        where.business_id = business_id;
      }

      if (customer_id) {
        where.customer_id = customer_id;
      }

      if (order_id) {
        where.order_id = order_id;
      }

      if (status) {
        where.status = status;
      }

      if (method) {
        where.method = method;
      }

      if (razorpay_payment_id) {
        where.razorpay_payment_id = razorpay_payment_id;
      }

      if (razorpay_order_id) {
        where.razorpay_order_id = razorpay_order_id;
      }

      // Date range filter
      if (from_date || to_date) {
        where.created_at = {};
        if (from_date) {
          where.created_at.gte = new Date(from_date);
        }
        if (to_date) {
          where.created_at.lte = new Date(to_date);
        }
      }

      // Amount range filter
      if (min_amount !== undefined || max_amount !== undefined) {
        where.amount = {};
        if (min_amount !== undefined) {
          where.amount.gte = min_amount;
        }
        if (max_amount !== undefined) {
          where.amount.lte = max_amount;
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Fetch payments and total count in parallel
      const [payments, total] = await Promise.all([
        this.prisma.payments.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sort_by]: order },
        }),
        this.prisma.payments.count({ where }),
      ]);

      this.logger.log(`Found ${payments.length} payments (total: ${total})`);

      return {
        data: payments.map(p => this.toDomainPayment(p)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to find payments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update payment
   */
  async update(paymentId: string, data: Partial<Payment>): Promise<Payment> {
    try {
      const updated = await this.prisma.payments.update({
        where: { payment_id: paymentId },
        data: data as any,
      });

      this.logger.log(`Payment updated: ${updated.payment_id}`);
      return this.toDomainPayment(updated);
    } catch (error) {
      this.logger.error(`Failed to update payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update payment status with metadata
   * Used when payment transitions between states
   */
  async updateStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: Partial<Payment>,
  ): Promise<Payment> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date(),
      };

      // Add status-specific timestamps
      if (status === PaymentStatus.AUTHORIZED) {
        updateData.authorized_at = new Date();
      } else if (status === PaymentStatus.CAPTURED) {
        updateData.captured_at = new Date();
      } else if (status === PaymentStatus.FAILED) {
        updateData.failed_at = new Date();
      } else if (status === PaymentStatus.REFUNDED || status === PaymentStatus.PARTIAL_REFUND) {
        updateData.refunded_at = new Date();
      }

      // Merge additional metadata
      if (metadata) {
        Object.assign(updateData, metadata);
      }

      const updated = await this.prisma.payments.update({
        where: { payment_id: paymentId },
        data: updateData,
      });

      this.logger.log(`Payment status updated: ${paymentId} → ${status}`);
      return this.toDomainPayment(updated);
    } catch (error) {
      this.logger.error(`Failed to update payment status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create webhook record
   * Stores all webhook events for audit trail
   */
  async createWebhook(webhook: Partial<PaymentWebhook>): Promise<PaymentWebhook> {
    try {
      const created = await this.prisma.payment_webhooks.create({
        data: {
          payment_id: webhook.payment_id,
          event_type: webhook.event_type,
          razorpay_event_id: webhook.razorpay_event_id,
          payload: webhook.payload as any,
          signature: webhook.signature,
          status: webhook.status || WebhookStatus.PENDING,
          retry_count: webhook.retry_count || 0,
          received_at: webhook.received_at || new Date(),
        } as any,
      });

      this.logger.log(`Webhook created: ${created.webhook_id} - ${created.event_type}`);
      return this.toDomainWebhook(created);
    } catch (error) {
      this.logger.error(`Failed to create webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find webhook by Razorpay event ID
   * Used for idempotency (prevent duplicate webhook processing)
   */
  async findWebhookByEventId(eventId: string): Promise<PaymentWebhook | null> {
    try {
      const webhook = await this.prisma.payment_webhooks.findUnique({
        where: { razorpay_event_id: eventId },
      });

      return webhook ? this.toDomainWebhook(webhook) : null;
    } catch (error) {
      this.logger.error(`Failed to find webhook by event ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update webhook record
   */
  async updateWebhook(webhookId: string, data: Partial<PaymentWebhook>): Promise<PaymentWebhook> {
    try {
      const updated = await this.prisma.payment_webhooks.update({
        where: { webhook_id: webhookId },
        data: data as any,
      });

      this.logger.log(`Webhook updated: ${updated.webhook_id}`);
      return this.toDomainWebhook(updated);
    } catch (error) {
      this.logger.error(`Failed to update webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Convert Prisma payment to domain entity
   * Handles Decimal to number conversion
   */
  private toDomainPayment(prismaPayment: any): Payment {
    return {
      ...prismaPayment,
      amount: prismaPayment.amount ? Number(prismaPayment.amount) : 0,
      refund_amount: prismaPayment.refund_amount ? Number(prismaPayment.refund_amount) : 0,
    } as Payment;
  }

  /**
   * Convert Prisma webhook to domain entity
   */
  private toDomainWebhook(prismaWebhook: any): PaymentWebhook {
    return {
      ...prismaWebhook,
      payload: prismaWebhook.payload,
    } as PaymentWebhook;
  }
}
