import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { OrderRepositoryPrisma } from '../../infrastructure/order.repository.prisma';
import { Order, OrderStatus, PaymentMethod } from '../../domain/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderStatusDto, ConfirmPaymentDto, UpdateShippingDto } from '../dto/update-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerService } from '../../../customers/application/services/customer.service';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { NotificationChannel } from '../../../notifications/domain/entities';

/**
 * Order Service
 * Handles all business logic for order management
 * Production-grade service with order lifecycle management
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orderRepository: OrderRepositoryPrisma,
    private readonly customerService: CustomerService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new order
   * Validates products, calculates pricing, creates order with items
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      // Validate business exists
      await this.validateBusinessExists(createOrderDto.business_id);

      // Validate customer exists
      const customer = await this.customerService.findById(createOrderDto.customer_id);
      if (!customer) {
        throw new NotFoundException(`Customer not found: ${createOrderDto.customer_id}`);
      }

      // Validate all products exist and have sufficient stock
      for (const item of createOrderDto.items) {
        await this.validateProductAndStock(item.product_id, item.variant_id, item.quantity);
      }

      // Create order with items (repository handles transaction)
      const order = await this.orderRepository.create(createOrderDto);

      // Update customer stats asynchronously (fire and forget)
      this.updateCustomerStats(createOrderDto.customer_id, Number(order.total_amount)).catch(
        (error) => this.logger.error(`Failed to update customer stats: ${error.message}`),
      );

      // Send order confirmation notification
      this.sendOrderConfirmationNotification(order, customer).catch(
        (error) => this.logger.error(`Failed to send order confirmation: ${error.message}`),
      );

      this.logger.log(
        `Order created successfully: ${order.order_number} for customer ${customer.phone}`,
      );

      return order;
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find order by ID
   */
  async findById(orderId: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      return order;
    } catch (error) {
      this.logger.error(`Failed to find order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all orders with filtering and pagination
   */
  async findAll(
    query: OrderQueryDto,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    try {
      // Validate business exists if filter provided
      if (query.business_id) {
        await this.validateBusinessExists(query.business_id);
      }

      const result = await this.orderRepository.findAll(query);

      this.logger.log(
        `Retrieved ${result.data.length} orders (page ${result.page}/${Math.ceil(result.total / result.limit)})`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to find orders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order details
   */
  async update(orderId: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    try {
      // Check if order exists
      const existingOrder = await this.orderRepository.findById(orderId);
      if (!existingOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Don't allow updates to delivered or cancelled orders
      if (
        existingOrder.status === OrderStatus.DELIVERED ||
        existingOrder.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot update order in ${existingOrder.status} status`,
        );
      }

      const updated = await this.orderRepository.update(orderId, updateOrderDto);

      this.logger.log(`Order updated successfully: ${orderId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    try {
      // Check if order exists
      const existingOrder = await this.orderRepository.findById(orderId);
      if (!existingOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Validate status transition
      this.validateStatusTransition(existingOrder.status, updateStatusDto.status);

      const updated = await this.orderRepository.updateStatus(
        orderId,
        updateStatusDto.status,
        updateStatusDto.notes,
      );

      // Send delivery notification when order is marked as delivered
      if (updateStatusDto.status === OrderStatus.DELIVERED) {
        const customer = await this.customerService.findById(existingOrder.customer_id);
        this.sendDeliveryNotification(updated, customer).catch(
          (error) => this.logger.error(`Failed to send delivery notification: ${error.message}`),
        );
      }

      this.logger.log(`Order status updated: ${orderId} → ${updateStatusDto.status}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update order status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Confirm payment for order
   */
  async confirmPayment(
    orderId: string,
    confirmPaymentDto: ConfirmPaymentDto,
  ): Promise<Order> {
    try {
      // Check if order exists
      const existingOrder = await this.orderRepository.findById(orderId);
      if (!existingOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Check if already paid
      if (existingOrder.payment_status === 'paid') {
        throw new ConflictException('Order is already paid');
      }

      const updated = await this.orderRepository.confirmPayment(
        orderId,
        confirmPaymentDto.payment_method,
        confirmPaymentDto.payment_reference,
      );

      // Send payment confirmation notification
      const customer = await this.customerService.findById(existingOrder.customer_id);
      this.sendPaymentConfirmationNotification(updated, customer).catch(
        (error) => this.logger.error(`Failed to send payment confirmation: ${error.message}`),
      );

      this.logger.log(
        `Payment confirmed for order: ${orderId} via ${confirmPaymentDto.payment_method}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(`Failed to confirm payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update shipping information
   */
  async updateShipping(
    orderId: string,
    updateShippingDto: UpdateShippingDto,
  ): Promise<Order> {
    try {
      // Check if order exists
      const existingOrder = await this.orderRepository.findById(orderId);
      if (!existingOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Order must be paid before shipping
      if (existingOrder.payment_status !== 'paid') {
        throw new BadRequestException('Order must be paid before adding shipping info');
      }

      const updated = await this.orderRepository.updateShipping(
        orderId,
        updateShippingDto.tracking_number,
        updateShippingDto.carrier,
      );

      // Auto-update status to shipped
      await this.orderRepository.updateStatus(orderId, OrderStatus.SHIPPED);

      // Send shipping notification
      const customer = await this.customerService.findById(existingOrder.customer_id);
      this.sendShippingNotification(updated, customer, updateShippingDto.tracking_number, updateShippingDto.carrier).catch(
        (error) => this.logger.error(`Failed to send shipping notification: ${error.message}`),
      );

      this.logger.log(`Shipping info updated for order: ${orderId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update shipping: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancel(orderId: string, reason?: string): Promise<Order> {
    try {
      // Check if order exists
      const existingOrder = await this.orderRepository.findById(orderId);
      if (!existingOrder) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Can't cancel already delivered or cancelled orders
      if (
        existingOrder.status === OrderStatus.DELIVERED ||
        existingOrder.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot cancel order in ${existingOrder.status} status`,
        );
      }

      const cancelled = await this.orderRepository.cancel(orderId, reason);

      this.logger.log(`Order cancelled: ${orderId}. Reason: ${reason || 'Not specified'}`);
      return cancelled;
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get order analytics for a business
   */
  async getOrderStats(
    businessId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_orders: number;
    total_revenue: number;
    pending_orders: number;
    completed_orders: number;
    average_order_value: number;
  }> {
    try {
      await this.validateBusinessExists(businessId);

      const stats = await this.orderRepository.getOrderStats(businessId, startDate, endDate);

      this.logger.log(`Order stats retrieved for business: ${businessId}`);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get order stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate product exists and has sufficient stock
   */
  private async validateProductAndStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ): Promise<void> {
    const product = await this.prisma.products.findUnique({
      where: { product_id: productId },
      include: { product_variants: true },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    if (!product.is_active) {
      throw new BadRequestException(`Product is not active: ${product.name}`);
    }

    // Check stock if inventory tracking is enabled
    if (product.track_inventory) {
      if (variantId) {
        const variant = product.product_variants.find((v) => v.variant_id === variantId);
        if (!variant) {
          throw new NotFoundException(`Product variant not found: ${variantId}`);
        }
        if (!variant.in_stock || variant.quantity < quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name} - ${variant.name}. Available: ${variant.quantity}, Requested: ${quantity}`,
          );
        }
      } else {
        if (!product.in_stock || (product.stock_quantity !== null && product.stock_quantity < quantity)) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${quantity}`,
          );
        }
      }
    }
  }

  /**
   * Validate status transition is allowed
   */
  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    // Define allowed transitions
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
      [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [], // Final state - no transitions
      [OrderStatus.CANCELLED]: [], // Final state - no transitions
      [OrderStatus.REFUNDED]: [], // Final state - no transitions
      [OrderStatus.FAILED]: [OrderStatus.PENDING], // Allow retry
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} → ${newStatus}`,
      );
    }
  }

  /**
   * Update customer order stats
   */
  private async updateCustomerStats(customerId: string, orderAmount: number): Promise<void> {
    try {
      await this.customerService.incrementOrderStats(customerId, orderAmount);
    } catch (error) {
      // Log but don't throw - this is a non-critical update
      this.logger.warn(`Failed to update customer stats: ${error.message}`);
    }
  }

  /**
   * Validate business exists
   */
  private async validateBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.businesses.findUnique({
      where: { business_id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business not found: ${businessId}`);
    }
  }

  /**
   * Send order confirmation notification
   */
  private async sendOrderConfirmationNotification(order: any, customer: any): Promise<void> {
    try {
      await this.notificationService.send({
        business_id: order.business_id,
        tenant_id: order.tenant_id,
        customer_id: order.customer_id,
        recipient_email: customer.email,
        recipient_phone: customer.phone,
        recipient_name: customer.name,
        channel: NotificationChannel.EMAIL,
        subject: `Order Confirmation - ${order.order_number}`,
        body: `Thank you for your order! Your order ${order.order_number} has been received and is being processed.`,
        html_body: `
          <h2>Order Confirmation</h2>
          <p>Thank you for your order, ${customer.name || 'valued customer'}!</p>
          <p>Order Number: <strong>${order.order_number}</strong></p>
          <p>Order Total: <strong>₹${Number(order.total_amount).toFixed(2)}</strong></p>
          <p>We'll notify you when your order is shipped.</p>
        `,
        related_entity_type: 'order',
        related_entity_id: order.order_id,
      });
    } catch (error) {
      this.logger.warn(`Failed to send order confirmation: ${error.message}`);
    }
  }

  /**
   * Send payment confirmation notification
   */
  private async sendPaymentConfirmationNotification(order: any, customer: any): Promise<void> {
    try {
      await this.notificationService.send({
        business_id: order.business_id,
        tenant_id: order.tenant_id,
        customer_id: order.customer_id,
        recipient_email: customer.email,
        recipient_phone: customer.phone,
        recipient_name: customer.name,
        channel: NotificationChannel.EMAIL,
        subject: `Payment Received - ${order.order_number}`,
        body: `Payment received for order ${order.order_number}. Your order is now being processed.`,
        html_body: `
          <h2>Payment Confirmation</h2>
          <p>Hi ${customer.name || 'valued customer'},</p>
          <p>We've received your payment for order <strong>${order.order_number}</strong></p>
          <p>Amount Paid: <strong>₹${Number(order.total_amount).toFixed(2)}</strong></p>
          <p>Payment Method: <strong>${order.payment_method}</strong></p>
          <p>Your order is now being prepared for shipment.</p>
        `,
        related_entity_type: 'order',
        related_entity_id: order.order_id,
      });
    } catch (error) {
      this.logger.warn(`Failed to send payment confirmation: ${error.message}`);
    }
  }

  /**
   * Send shipping notification
   */
  private async sendShippingNotification(
    order: any,
    customer: any,
    trackingNumber: string,
    carrier: string,
  ): Promise<void> {
    try {
      await this.notificationService.send({
        business_id: order.business_id,
        tenant_id: order.tenant_id,
        customer_id: order.customer_id,
        recipient_email: customer.email,
        recipient_phone: customer.phone,
        recipient_name: customer.name,
        channel: NotificationChannel.EMAIL,
        subject: `Order Shipped - ${order.order_number}`,
        body: `Your order ${order.order_number} has been shipped! Tracking: ${trackingNumber} (${carrier})`,
        html_body: `
          <h2>Order Shipped</h2>
          <p>Great news ${customer.name || 'valued customer'}!</p>
          <p>Your order <strong>${order.order_number}</strong> has been shipped.</p>
          <p>Carrier: <strong>${carrier}</strong></p>
          <p>Tracking Number: <strong>${trackingNumber}</strong></p>
          <p>You'll receive another notification when your order is delivered.</p>
        `,
        related_entity_type: 'order',
        related_entity_id: order.order_id,
      });
    } catch (error) {
      this.logger.warn(`Failed to send shipping notification: ${error.message}`);
    }
  }

  /**
   * Send delivery notification
   */
  private async sendDeliveryNotification(order: any, customer: any): Promise<void> {
    try {
      await this.notificationService.send({
        business_id: order.business_id,
        tenant_id: order.tenant_id,
        customer_id: order.customer_id,
        recipient_email: customer.email,
        recipient_phone: customer.phone,
        recipient_name: customer.name,
        channel: NotificationChannel.EMAIL,
        subject: `Order Delivered - ${order.order_number}`,
        body: `Your order ${order.order_number} has been delivered! We hope you enjoy your purchase.`,
        html_body: `
          <h2>Order Delivered</h2>
          <p>Hi ${customer.name || 'valued customer'},</p>
          <p>Your order <strong>${order.order_number}</strong> has been successfully delivered!</p>
          <p>We hope you're satisfied with your purchase. If you have any questions or concerns, please don't hesitate to reach out.</p>
          <p>Thank you for shopping with us!</p>
        `,
        related_entity_type: 'order',
        related_entity_id: order.order_id,
      });
    } catch (error) {
      this.logger.warn(`Failed to send delivery notification: ${error.message}`);
    }
  }
}
