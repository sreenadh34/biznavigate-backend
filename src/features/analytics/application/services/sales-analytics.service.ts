import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SalesAnalyticsDto, TopProductDto } from '../dto/analytics-response.dto';

/**
 * Sales Analytics Service
 * Provides comprehensive sales performance metrics and insights
 */
@Injectable()
export class SalesAnalyticsService {
  private readonly logger = new Logger(SalesAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive sales analytics
   */
  async getSalesAnalytics(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesAnalyticsDto> {
    this.logger.log(`Getting sales analytics for business ${businessId}`);

    // Calculate previous period for growth comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDuration);
    const previousEndDate = new Date(startDate.getTime());

    // Current period metrics
    const [currentOrders, previousOrders, dailyStats, statusBreakdown] = await Promise.all([
      // Current period orders
      this.prisma.orders.findMany({
        where: {
          business_id: businessId,
          created_at: { gte: startDate, lte: endDate },
          status: { not: 'cancelled' },
        },
        select: {
          total_amount: true,
          status: true,
          created_at: true,
          order_items: {
            select: {
              quantity: true,
            },
          },
        },
      }),

      // Previous period orders for growth calculation
      this.prisma.orders.findMany({
        where: {
          business_id: businessId,
          created_at: { gte: previousStartDate, lt: previousEndDate },
          status: { not: 'cancelled' },
        },
        select: {
          total_amount: true,
        },
      }),

      // Daily revenue breakdown
      this.prisma.$queryRaw<Array<{ date: Date; revenue: number; orders: number }>>`
        SELECT
          DATE(created_at) as date,
          SUM(total_amount)::DECIMAL as revenue,
          COUNT(*)::INTEGER as orders
        FROM orders
        WHERE business_id = ${businessId}::uuid
          AND created_at >= ${startDate}::timestamp
          AND created_at <= ${endDate}::timestamp
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Orders by status
      this.prisma.orders.groupBy({
        by: ['status'],
        where: {
          business_id: businessId,
          created_at: { gte: startDate, lte: endDate },
        },
        _count: true,
      }),
    ]);

    // Calculate current period metrics
    const totalRevenue = currentOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const totalOrders = currentOrders.length;
    const totalItemsSold = currentOrders.reduce(
      (sum, order) => sum + order.order_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate previous period metrics
    const previousRevenue = previousOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const previousOrderCount = previousOrders.length;

    // Calculate growth percentages
    const revenueGrowth =
      previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth =
      previousOrderCount > 0
        ? ((totalOrders - previousOrderCount) / previousOrderCount) * 100
        : 0;

    // Format daily revenue
    const dailyRevenue = dailyStats.map((stat) => ({
      date: stat.date.toISOString().split('T')[0],
      revenue: Number(stat.revenue),
      orders: stat.orders,
    }));

    // Format orders by status
    const ordersByStatus: Record<string, number> = {};
    statusBreakdown.forEach((item) => {
      ordersByStatus[item.status] = item._count;
    });

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      totalItemsSold,
      revenueGrowth,
      ordersGrowth,
      dailyRevenue,
      ordersByStatus,
    };
  }

  /**
   * Get top selling products
   */
  async getTopProducts(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TopProductDto[]> {
    this.logger.log(`Getting top ${limit} products for business ${businessId}`);

    const topProducts = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        product_name: string;
        quantity_sold: bigint;
        revenue: number;
        order_count: bigint;
      }>
    >`
      SELECT
        p.product_id,
        p.product_name,
        SUM(oi.quantity)::BIGINT as quantity_sold,
        SUM(oi.price * oi.quantity)::DECIMAL as revenue,
        COUNT(DISTINCT o.order_id)::BIGINT as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      JOIN products p ON oi.product_id = p.product_id
      WHERE o.business_id = ${businessId}::uuid
        AND o.created_at >= ${startDate}::timestamp
        AND o.created_at <= ${endDate}::timestamp
        AND o.status != 'cancelled'
      GROUP BY p.product_id, p.product_name
      ORDER BY quantity_sold DESC
      LIMIT ${limit}
    `;

    return topProducts.map((product) => ({
      productId: product.product_id,
      productName: product.product_name,
      quantitySold: Number(product.quantity_sold),
      revenue: Number(product.revenue),
      orderCount: Number(product.order_count),
    }));
  }

  /**
   * Get revenue by time period (hourly, daily, weekly, monthly)
   */
  async getRevenueByPeriod(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<Array<{ period: string; revenue: number; orders: number }>> {
    this.logger.log(`Getting revenue by ${period} for business ${businessId}`);

    let dateFormat: string;
    switch (period) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW'; // ISO week
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    const results = await this.prisma.$queryRaw<
      Array<{ period: string; revenue: number; orders: number }>
    >`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(total_amount)::DECIMAL as revenue,
        COUNT(*)::INTEGER as orders
      FROM orders
      WHERE business_id = ${businessId}::uuid
        AND created_at >= ${startDate}::timestamp
        AND created_at <= ${endDate}::timestamp
        AND status != 'cancelled'
      GROUP BY TO_CHAR(created_at, ${dateFormat})
      ORDER BY period ASC
    `;

    return results.map((row) => ({
      period: row.period,
      revenue: Number(row.revenue),
      orders: row.orders,
    }));
  }
}
