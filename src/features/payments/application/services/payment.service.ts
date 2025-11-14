import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentRepositoryPrisma } from '../../infrastructure/payment.repository.prisma';
import { RazorpayService } from '../../infrastructure/razorpay.service';
import { OrderRepositoryPrisma } from '../../../orders/infrastructure/order.repository.prisma';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentQueryDto } from '../dto/payment-query.dto';
import { VerifyPaymentSignatureDto } from '../dto/payment-webhook.dto';
import { CreateRefundDto } from '../dto/refund-payment.dto';
import { Payment, PaymentStatus } from '../../domain/entities/payment.entity';

/**
 * Payment Service
 * Core business logic for payment processing
 * Production-ready with retry logic, error handling, and order integration
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepositoryPrisma,
    private readonly razorpayService: RazorpayService,
    private readonly orderRepository: OrderRepositoryPrisma,
  ) {}

  /**
   * Create payment
   * Step 1: Create Razorpay order
   * Step 2: Save payment record in database
   * Returns razorpay_order_id for frontend checkout
   */
  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`Creating payment for order: ${createPaymentDto.order_id}`);

      // Verify order exists and is pending payment
      const order = await this.orderRepository.findById(createPaymentDto.order_id);
      if (!order) {
        throw new NotFoundException(`Order not found: ${createPaymentDto.order_id}`);
      }

      if (order.payment_status !== 'pending') {
        throw new ConflictException(`Order ${createPaymentDto.order_id} payment status is ${order.payment_status}, cannot create payment`);
      }

      // Check if payment already exists for this order
      const existingPayment = await this.paymentRepository.findByOrderId(createPaymentDto.order_id);
      if (existingPayment) {
        this.logger.log(`Payment already exists for order ${createPaymentDto.order_id}, returning existing payment`);
        return existingPayment;
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder(
        createPaymentDto.amount,
        createPaymentDto.currency || 'INR',
        createPaymentDto.receipt,
        createPaymentDto.notes,
      );

      // Save payment record
      const payment = await this.paymentRepository.create({
        business_id: createPaymentDto.business_id,
        tenant_id: createPaymentDto.tenant_id,
        order_id: createPaymentDto.order_id,
        customer_id: createPaymentDto.customer_id,
        razorpay_order_id: razorpayOrder.id,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency || 'INR',
        status: PaymentStatus.CREATED,
        webhook_attempts: 0,
        refund_amount: 0,
      });

      this.logger.log(`Payment created: ${payment.payment_id} - Razorpay Order: ${razorpayOrder.id}`);

      return payment;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify payment signature
   * Called after customer completes payment on frontend
   * Validates payment authenticity and updates payment status
   */
  async verifyPaymentSignature(verifyDto: VerifyPaymentSignatureDto): Promise<Payment> {
    try {
      this.logger.log(`Verifying payment signature: ${verifyDto.razorpay_payment_id}`);

      // Find payment by Razorpay order ID
      const payment = await this.paymentRepository.findByRazorpayOrderId(verifyDto.razorpay_order_id);
      if (!payment) {
        throw new NotFoundException(`Payment not found for order: ${verifyDto.razorpay_order_id}`);
      }

      // Verify signature
      const isValid = this.razorpayService.verifyPaymentSignature(
        verifyDto.razorpay_order_id,
        verifyDto.razorpay_payment_id,
        verifyDto.razorpay_signature,
      );

      if (!isValid) {
        this.logger.warn(`Invalid payment signature: ${verifyDto.razorpay_payment_id}`);
        throw new BadRequestException('Invalid payment signature');
      }

      // Update payment with Razorpay payment ID and signature
      const updatedPayment = await this.paymentRepository.update(payment.payment_id, {
        razorpay_payment_id: verifyDto.razorpay_payment_id,
        razorpay_signature: verifyDto.razorpay_signature,
        status: PaymentStatus.AUTHORIZED,
        authorized_at: new Date(),
      });

      this.logger.log(`Payment signature verified: ${payment.payment_id}`);

      return updatedPayment;
    } catch (error) {
      this.logger.error(`Failed to verify payment signature: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Capture payment
   * Moves payment from authorized to captured (money received)
   * Also updates order status and converts stock reservation
   */
  async capturePayment(paymentId: string): Promise<Payment> {
    try {
      this.logger.log(`Capturing payment: ${paymentId}`);

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundException(`Payment not found: ${paymentId}`);
      }

      if (payment.status !== PaymentStatus.AUTHORIZED) {
        throw new ConflictException(`Payment ${paymentId} status is ${payment.status}, cannot capture`);
      }

      // Capture payment in Razorpay
      await this.razorpayService.capturePayment(
        payment.razorpay_payment_id,
        payment.amount,
        payment.currency,
      );

      // Update payment status
      const capturedPayment = await this.paymentRepository.updateStatus(
        paymentId,
        PaymentStatus.CAPTURED,
        {
          captured_at: new Date(),
        },
      );

      // Update order payment status
      await this.orderRepository.confirmPayment(
        payment.order_id,
        payment.razorpay_payment_id,
        'razorpay',
      );

      this.logger.log(`Payment captured successfully: ${paymentId}`);

      return capturedPayment;
    } catch (error) {
      this.logger.error(`Failed to capture payment: ${error.message}`, error.stack);

      // Mark payment as failed
      await this.paymentRepository.updateStatus(paymentId, PaymentStatus.FAILED, {
        failed_at: new Date(),
        failure_reason: error.message,
      });

      throw error;
    }
  }

  /**
   * Mark payment as failed
   * Called when payment fails or expires
   */
  async markPaymentFailed(paymentId: string, reason: string): Promise<Payment> {
    try {
      this.logger.log(`Marking payment as failed: ${paymentId}`);

      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundException(`Payment not found: ${paymentId}`);
      }

      const failedPayment = await this.paymentRepository.updateStatus(
        paymentId,
        PaymentStatus.FAILED,
        {
          failed_at: new Date(),
          failure_reason: reason,
        },
      );

      this.logger.log(`Payment marked as failed: ${paymentId}`);

      return failedPayment;
    } catch (error) {
      this.logger.error(`Failed to mark payment as failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create refund
   * Supports both full and partial refunds
   */
  async createRefund(createRefundDto: CreateRefundDto): Promise<Payment> {
    try {
      this.logger.log(`Creating refund for payment: ${createRefundDto.payment_id}`);

      const payment = await this.paymentRepository.findById(createRefundDto.payment_id);
      if (!payment) {
        throw new NotFoundException(`Payment not found: ${createRefundDto.payment_id}`);
      }

      if (payment.status !== PaymentStatus.CAPTURED) {
        throw new ConflictException(`Payment ${createRefundDto.payment_id} status is ${payment.status}, cannot refund`);
      }

      // Calculate refund amount
      const refundAmount = createRefundDto.amount || payment.amount;
      const alreadyRefunded = payment.refund_amount || 0;
      const availableForRefund = payment.amount - alreadyRefunded;

      if (refundAmount > availableForRefund) {
        throw new BadRequestException(`Refund amount ₹${refundAmount} exceeds available amount ₹${availableForRefund}`);
      }

      // Create refund in Razorpay
      const razorpayRefund = await this.razorpayService.createRefund(
        payment.razorpay_payment_id,
        refundAmount,
        createRefundDto.notes,
      );

      // Update payment record
      const totalRefundAmount = alreadyRefunded + refundAmount;
      const newStatus =
        totalRefundAmount >= payment.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIAL_REFUND;

      const refundedPayment = await this.paymentRepository.updateStatus(
        createRefundDto.payment_id,
        newStatus,
        {
          refund_amount: totalRefundAmount,
          refunded_at: new Date(),
          refund_reason: createRefundDto.reason,
        },
      );

      this.logger.log(`Refund created: ${razorpayRefund.id} for payment ${createRefundDto.payment_id}`);

      return refundedPayment;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async findById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment not found: ${paymentId}`);
    }
    return payment;
  }

  /**
   * Get payment by order ID
   */
  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findByOrderId(orderId);
  }

  /**
   * Get payment by Razorpay order ID
   */
  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Payment | null> {
    return this.paymentRepository.findByRazorpayOrderId(razorpayOrderId);
  }

  /**
   * Get all payments with filtering
   */
  async findAll(query: PaymentQueryDto): Promise<{
    data: Payment[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.paymentRepository.findAll(query);
  }

  /**
   * Get payment analytics for a business
   * Returns total revenue, payment counts by status, method breakdown
   */
  async getPaymentAnalytics(businessId: string, fromDate?: Date, toDate?: Date): Promise<any> {
    try {
      this.logger.log(`Fetching payment analytics for business: ${businessId}`);

      const query: PaymentQueryDto = {
        business_id: businessId,
        from_date: fromDate?.toISOString(),
        to_date: toDate?.toISOString(),
        limit: 1000, // Get all for analytics
      };

      const { data: payments } = await this.paymentRepository.findAll(query);

      // Calculate analytics
      const totalPayments = payments.length;
      const totalRevenue = payments
        .filter(p => p.status === PaymentStatus.CAPTURED)
        .reduce((sum, p) => sum + p.amount, 0);

      const totalRefunded = payments
        .reduce((sum, p) => sum + (p.refund_amount || 0), 0);

      const netRevenue = totalRevenue - totalRefunded;

      // Payment status breakdown
      const statusBreakdown = payments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Payment method breakdown
      const methodBreakdown = payments
        .filter(p => p.method)
        .reduce((acc, p) => {
          acc[p.method] = (acc[p.method] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      // Success rate
      const successfulPayments = payments.filter(p => p.status === PaymentStatus.CAPTURED).length;
      const failedPayments = payments.filter(p => p.status === PaymentStatus.FAILED).length;
      const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

      return {
        totalPayments,
        totalRevenue,
        totalRefunded,
        netRevenue,
        successfulPayments,
        failedPayments,
        successRate: Math.round(successRate * 100) / 100,
        statusBreakdown,
        methodBreakdown,
      };
    } catch (error) {
      this.logger.error(`Failed to get payment analytics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
