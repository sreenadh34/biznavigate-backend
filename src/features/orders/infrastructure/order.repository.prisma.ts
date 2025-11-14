// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Order, OrderItem, OrderStatus, PaymentStatus } from '../domain/entities/order.entity';
import { CreateOrderDto } from '../application/dto/create-order.dto';
import { UpdateOrderDto } from '../application/dto/update-order.dto';
import { OrderQueryDto } from '../application/dto/order-query.dto';
import { StockReservationService } from '../application/services/stock-reservation.service';

/**
 * Order Repository (Prisma Implementation)
 * Handles all database operations for orders
 */
@Injectable()
export class OrderRepositoryPrisma {
  private readonly logger = new Logger(OrderRepositoryPrisma.name);
  private readonly PAYMENT_TIMEOUT_MINUTES = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockReservationService: StockReservationService,
  ) {}

  /**
   * Create a new order with items
   * Uses transaction to ensure atomicity
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      // Generate order number
      const orderNumber = await this.generateOrderNumber(createOrderDto.business_id);

      // Create order with items in a transaction
      const order = await this.prisma.$transaction(async (tx) => {
        // First, calculate subtotal by fetching product prices
        let subtotal = 0;

        for (const item of createOrderDto.items) {
          const product = await tx.products.findUnique({
            where: { product_id: item.product_id },
            include: { product_variants: true },
          });

          const variant = item.variant_id
            ? product?.product_variants.find((v) => v.variant_id === item.variant_id)
            : null;

          const unitPrice = variant ? Number(variant.price) : Number(product?.price || 0);
          const itemTotal = unitPrice * item.quantity - (item.discount || 0);
          subtotal += itemTotal;
        }

        const totalAmount =
          subtotal +
          (createOrderDto.tax_amount || 0) +
          (createOrderDto.shipping_fee || 0) -
          (createOrderDto.discount_amount || 0);

        // Calculate payment expiry time
        const paymentExpiresAt = new Date(
          Date.now() + this.PAYMENT_TIMEOUT_MINUTES * 60 * 1000,
        );

        // Create the order
        const createdOrder = await tx.orders.create({
          data: {
            business_id: createOrderDto.business_id,
            tenant_id: createOrderDto.tenant_id,
            customer_id: createOrderDto.customer_id,
            order_number: orderNumber,
            status: 'pending',
            subtotal,
            discount_amount: createOrderDto.discount_amount || 0,
            tax_amount: createOrderDto.tax_amount || 0,
            shipping_fee: createOrderDto.shipping_fee || 0,
            total_amount: totalAmount,
            payment_status: 'pending',
            payment_expires_at: paymentExpiresAt,
            shipping_address: createOrderDto.shipping_address,
            shipping_city: createOrderDto.shipping_city,
            shipping_state: createOrderDto.shipping_state,
            shipping_pincode: createOrderDto.shipping_pincode,
            shipping_phone: createOrderDto.shipping_phone,
            notes: createOrderDto.notes,
            source: createOrderDto.source || 'whatsapp',
          },
          include: {
            order_items: true,
          },
        });

        // Create order items
        for (const item of createOrderDto.items) {
          // Fetch product details for snapshot
          const product = await tx.products.findUnique({
            where: { product_id: item.product_id },
            include: { product_variants: true },
          });

          const variant = item.variant_id
            ? product?.product_variants.find((v) => v.variant_id === item.variant_id)
            : null;

          const unitPrice = variant ? Number(variant.price) : Number(product?.price || 0);
          const totalPrice = unitPrice * item.quantity - (item.discount || 0);

          await tx.order_items.create({
            data: {
              order_id: createdOrder.order_id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              product_name: product?.name || 'Unknown Product',
              variant_name: variant?.name,
              sku: variant?.sku || product?.sku,
              quantity: item.quantity,
              unit_price: unitPrice,
              discount: item.discount || 0,
              total_price: totalPrice,
              snapshot: {
                product_name: product?.name,
                product_description: product?.description,
                variant_name: variant?.name,
                variant_options: variant?.variant_options,
                price: unitPrice,
              },
            },
          });

          // Reserve stock instead of immediate deduction (production-safe)
          if (product?.track_inventory) {
            await this.stockReservationService.reserveStock(
              createdOrder.order_id,
              item.product_id,
              item.variant_id,
              item.quantity,
            );
          }
        }

        // Fetch complete order with items
        return await tx.orders.findUnique({
          where: { order_id: createdOrder.order_id },
          include: { order_items: true },
        });
      });

      this.logger.log(`Order created: ${order.order_number} (${order.order_id})`);
      return this.toDomainOrder(order);
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find order by ID with items
   */
  async findById(orderId: string): Promise<Order | null> {
    try {
      const order = await this.prisma.orders.findUnique({
        where: { order_id: orderId },
        include: { order_items: true },
      });

      return order ? this.toDomainOrder(order) : null;
    } catch (error) {
      this.logger.error(`Failed to find order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all orders with filtering, pagination, and sorting
   */
  async findAll(
    query: OrderQueryDto,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    try {
      const {
        business_id,
        customer_id,
        status,
        payment_status,
        source,
        from_date,
        to_date,
        min_amount,
        max_amount,
        search,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        order = 'desc',
      } = query;

      // Build where clause
      const where: any = {};

      if (business_id) where.business_id = business_id;
      if (customer_id) where.customer_id = customer_id;
      if (status) where.status = status;
      if (payment_status) where.payment_status = payment_status;
      if (source) where.source = source;

      // Date range filter
      if (from_date || to_date) {
        where.created_at = {};
        if (from_date) where.created_at.gte = new Date(from_date);
        if (to_date) where.created_at.lte = new Date(to_date);
      }

      // Amount range filter
      if (min_amount !== undefined || max_amount !== undefined) {
        where.total_amount = {};
        if (min_amount !== undefined) where.total_amount.gte = min_amount;
        if (max_amount !== undefined) where.total_amount.lte = max_amount;
      }

      // Search by order number or customer info
      if (search) {
        where.OR = [
          { order_number: { contains: search, mode: 'insensitive' } },
          {
            customers: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            },
          },
        ];
      }

      // Pagination
      const skip = (page - 1) * limit;

      // Sorting
      const orderBy: any = {};
      orderBy[sort_by] = order;

      // Execute queries in parallel
      const [orders, total] = await Promise.all([
        this.prisma.orders.findMany({
          where,
          include: { order_items: true, customers: true },
          skip,
          take: limit,
          orderBy,
        }),
        this.prisma.orders.count({ where }),
      ]);

      return {
        data: orders.map((order) => this.toDomainOrder(order)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to find orders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order
   */
  async update(orderId: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    try {
      const updated = await this.prisma.orders.update({
        where: { order_id: orderId },
        data: {
          shipping_address: updateOrderDto.shipping_address,
          shipping_city: updateOrderDto.shipping_city,
          shipping_state: updateOrderDto.shipping_state,
          shipping_pincode: updateOrderDto.shipping_pincode,
          shipping_phone: updateOrderDto.shipping_phone,
          notes: updateOrderDto.notes,
          admin_notes: updateOrderDto.admin_notes,
          updated_at: new Date(),
        },
        include: { order_items: true },
      });

      this.logger.log(`Order updated: ${orderId}`);
      return this.toDomainOrder(updated);
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
    status: OrderStatus,
    notes?: string,
  ): Promise<Order> {
    try {
      const data: any = {
        status,
        updated_at: new Date(),
      };

      if (notes) data.admin_notes = notes;

      // Set timestamps based on status
      if (status === OrderStatus.SHIPPED) {
        data.shipped_at = new Date();
      } else if (status === OrderStatus.DELIVERED) {
        data.delivered_at = new Date();
      } else if (status === OrderStatus.CANCELLED) {
        data.cancelled_at = new Date();
      }

      const updated = await this.prisma.orders.update({
        where: { order_id: orderId },
        data,
        include: { order_items: true },
      });

      this.logger.log(`Order status updated: ${orderId} → ${status}`);
      return this.toDomainOrder(updated);
    } catch (error) {
      this.logger.error(`Failed to update order status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(
    orderId: string,
    paymentMethod: string,
    paymentReference?: string,
  ): Promise<Order> {
    try {
      // Convert stock reservations to actual sales (production-safe)
      await this.stockReservationService.convertReservationToSale(orderId);

      const updated = await this.prisma.orders.update({
        where: { order_id: orderId },
        data: {
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          paid_at: new Date(),
          status: 'paid', // Auto-update status to paid
          updated_at: new Date(),
        },
        include: { order_items: true },
      });

      this.logger.log(`Payment confirmed for order: ${orderId} via ${paymentMethod}`);
      return this.toDomainOrder(updated);
    } catch (error) {
      this.logger.error(`Failed to confirm payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update shipping info
   */
  async updateShipping(
    orderId: string,
    trackingNumber: string,
    carrier?: string,
  ): Promise<Order> {
    try {
      const updated = await this.prisma.orders.update({
        where: { order_id: orderId },
        data: {
          tracking_number: trackingNumber,
          admin_notes: carrier ? `Carrier: ${carrier}` : undefined,
          updated_at: new Date(),
        },
        include: { order_items: true },
      });

      this.logger.log(`Shipping info updated for order: ${orderId}`);
      return this.toDomainOrder(updated);
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
      const order = await this.prisma.$transaction(async (tx) => {
        // Get order with items
        const existingOrder = await tx.orders.findUnique({
          where: { order_id: orderId },
          include: { order_items: true },
        });

        if (!existingOrder) {
          throw new Error('Order not found');
        }

        // Release stock reservations (production-safe)
        await this.stockReservationService.releaseReservation(orderId);

        // Update order status
        return await tx.orders.update({
          where: { order_id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            cancelled_at: new Date(),
            admin_notes: reason || 'Order cancelled',
            updated_at: new Date(),
          },
          include: { order_items: true },
        });
      });

      this.logger.log(`Order cancelled: ${orderId}`);
      return this.toDomainOrder(order);
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get order analytics for a business
   */
  async getOrderStats(businessId: string, startDate?: Date, endDate?: Date): Promise<{
    total_orders: number;
    total_revenue: number;
    pending_orders: number;
    completed_orders: number;
    average_order_value: number;
  }> {
    try {
      const where: any = { business_id: businessId };

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      const [total, pending, completed, revenueAgg] = await Promise.all([
        this.prisma.orders.count({ where }),
        this.prisma.orders.count({ where: { ...where, status: 'pending' } }),
        this.prisma.orders.count({ where: { ...where, status: 'delivered' } }),
        this.prisma.orders.aggregate({
          where: { ...where, payment_status: 'paid' },
          _sum: { total_amount: true },
        }),
      ]);

      const totalRevenue = Number(revenueAgg._sum.total_amount || 0);
      const averageOrderValue = total > 0 ? totalRevenue / total : 0;

      return {
        total_orders: total,
        total_revenue: totalRevenue,
        pending_orders: pending,
        completed_orders: completed,
        average_order_value: averageOrderValue,
      };
    } catch (error) {
      this.logger.error(`Failed to get order stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(businessId: string): Promise<string> {
    // Get count of orders for this business
    const count = await this.prisma.orders.count({
      where: { business_id: businessId },
    });

    // Format: ORD-00001, ORD-00002, etc.
    const orderNum = String(count + 1).padStart(5, '0');
    return `ORD-${orderNum}`;
  }

  /**
   * Convert Prisma order to domain Order entity
   */
  private toDomainOrder(prismaOrder: any): Order {
    return {
      order_id: prismaOrder.order_id,
      business_id: prismaOrder.business_id,
      tenant_id: prismaOrder.tenant_id,
      customer_id: prismaOrder.customer_id,
      order_number: prismaOrder.order_number,
      status: prismaOrder.status as OrderStatus,
      subtotal: Number(prismaOrder.subtotal || 0),
      discount_amount: Number(prismaOrder.discount_amount || 0),
      tax_amount: Number(prismaOrder.tax_amount || 0),
      shipping_fee: Number(prismaOrder.shipping_fee || 0),
      total_amount: Number(prismaOrder.total_amount || 0),
      payment_method: prismaOrder.payment_method,
      payment_status: prismaOrder.payment_status as PaymentStatus,
      payment_reference: prismaOrder.payment_reference,
      paid_at: prismaOrder.paid_at,
      shipping_address: prismaOrder.shipping_address,
      shipping_city: prismaOrder.shipping_city,
      shipping_state: prismaOrder.shipping_state,
      shipping_pincode: prismaOrder.shipping_pincode,
      shipping_phone: prismaOrder.shipping_phone,
      tracking_number: prismaOrder.tracking_number,
      shipped_at: prismaOrder.shipped_at,
      delivered_at: prismaOrder.delivered_at,
      notes: prismaOrder.notes,
      admin_notes: prismaOrder.admin_notes,
      source: prismaOrder.source,
      created_at: prismaOrder.created_at,
      updated_at: prismaOrder.updated_at,
      cancelled_at: prismaOrder.cancelled_at,
      items: prismaOrder.order_items?.map((item: any) => this.toDomainOrderItem(item)),
    };
  }

  /**
   * Convert Prisma order_item to domain OrderItem entity
   */
  private toDomainOrderItem(prismaItem: any): OrderItem {
    return {
      order_item_id: prismaItem.order_item_id,
      order_id: prismaItem.order_id,
      product_id: prismaItem.product_id,
      variant_id: prismaItem.variant_id,
      product_name: prismaItem.product_name,
      variant_name: prismaItem.variant_name,
      sku: prismaItem.sku,
      quantity: prismaItem.quantity,
      unit_price: Number(prismaItem.unit_price),
      discount: Number(prismaItem.discount || 0),
      total_price: Number(prismaItem.total_price),
      snapshot: prismaItem.snapshot,
      created_at: prismaItem.created_at,
      updated_at: prismaItem.updated_at,
    };
  }
}
