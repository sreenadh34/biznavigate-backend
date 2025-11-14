import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from '../services/payment.service';
import { PaymentWebhookService } from '../services/payment-webhook.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentQueryDto } from '../dto/payment-query.dto';
import { VerifyPaymentSignatureDto, PaymentWebhookDto } from '../dto/payment-webhook.dto';
import { CreateRefundDto } from '../dto/refund-payment.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/**
 * Payment Controller
 * Handles all HTTP endpoints for payment management
 * Production-grade with JWT authentication, webhook support, and comprehensive error handling
 */
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly webhookService: PaymentWebhookService,
  ) {}

  /**
   * POST /payments
   * Create a new payment
   * Returns razorpay_order_id for frontend checkout
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    try {
      this.logger.log(`Creating payment for order: ${createPaymentDto.order_id}`);
      const payment = await this.paymentService.create(createPaymentDto);

      return {
        success: true,
        message: 'Payment initiated successfully',
        data: {
          payment_id: payment.payment_id,
          razorpay_order_id: payment.razorpay_order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /payments/verify
   * Verify payment signature after customer completes payment
   * Called by frontend after Razorpay checkout completes
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifySignature(@Body() verifyDto: VerifyPaymentSignatureDto) {
    try {
      this.logger.log(`Verifying payment: ${verifyDto.razorpay_payment_id}`);
      const payment = await this.paymentService.verifyPaymentSignature(verifyDto);

      return {
        success: true,
        message: 'Payment verified successfully',
        data: {
          payment_id: payment.payment_id,
          status: payment.status,
          order_id: payment.order_id,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to verify payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /payments/:id/capture
   * Manually capture a payment
   * Used for 2-step payment flows (authorize then capture)
   */
  @Post(':id/capture')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async capture(@Param('id') id: string) {
    try {
      this.logger.log(`Capturing payment: ${id}`);
      const payment = await this.paymentService.capturePayment(id);

      return {
        success: true,
        message: 'Payment captured successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error(`Failed to capture payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /payments/:id/refund
   * Create a refund (full or partial)
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createRefund(
    @Param('id') id: string,
    @Body() createRefundDto: CreateRefundDto,
  ) {
    try {
      this.logger.log(`Creating refund for payment: ${id}`);

      // Set payment ID from URL param
      createRefundDto.payment_id = id;

      const payment = await this.paymentService.createRefund(createRefundDto);

      return {
        success: true,
        message: createRefundDto.amount
          ? `Partial refund of ₹${createRefundDto.amount} created successfully`
          : 'Full refund created successfully',
        data: {
          payment_id: payment.payment_id,
          refund_amount: payment.refund_amount,
          status: payment.status,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /payments/webhook
   * Razorpay webhook endpoint
   * No authentication (uses signature verification instead)
   * Must accept raw body for signature verification
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() webhookDto: PaymentWebhookDto,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      this.logger.log(`Received webhook: ${webhookDto.event}`);

      // Get raw body for signature verification
      // Note: NestJS needs raw body parser configured for this to work
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(webhookDto);

      const result = await this.webhookService.processWebhook(
        rawBody,
        signature,
        webhookDto,
      );

      return result;
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      // Return 200 even on error to prevent Razorpay from retrying invalid webhooks
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * GET /payments
   * Get all payments with filtering and pagination
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: PaymentQueryDto) {
    try {
      this.logger.log(`Fetching payments with filters: ${JSON.stringify(query)}`);
      const result = await this.paymentService.findAll(query);

      return {
        success: true,
        message: `Retrieved ${result.data.length} payments`,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /payments/analytics
   * Get payment analytics for a business
   * Returns revenue, success rate, method breakdown, etc.
   */
  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAnalytics(
    @Query('business_id') businessId: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    try {
      this.logger.log(`Fetching payment analytics for business: ${businessId}`);

      const from = fromDate ? new Date(fromDate) : undefined;
      const to = toDate ? new Date(toDate) : undefined;

      const analytics = await this.paymentService.getPaymentAnalytics(businessId, from, to);

      return {
        success: true,
        message: 'Payment analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch analytics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /payments/:id
   * Get payment by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching payment: ${id}`);
      const payment = await this.paymentService.findById(id);

      return {
        success: true,
        message: 'Payment retrieved successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /payments/order/:orderId
   * Get payment by order ID
   */
  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findByOrderId(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`Fetching payment for order: ${orderId}`);
      const payment = await this.paymentService.findByOrderId(orderId);

      if (!payment) {
        return {
          success: false,
          message: 'No payment found for this order',
          data: null,
        };
      }

      return {
        success: true,
        message: 'Payment retrieved successfully',
        data: payment,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment by order: ${error.message}`, error.stack);
      throw error;
    }
  }
}
