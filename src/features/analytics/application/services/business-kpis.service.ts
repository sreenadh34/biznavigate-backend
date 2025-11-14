import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BusinessKPIsDto } from '../dto/analytics-response.dto';

/**
 * Business KPIs Service
 * Provides key performance indicators for overall business health
 */
@Injectable()
export class BusinessKPIsService {
  private readonly logger = new Logger(BusinessKPIsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive business KPIs
   */
  async getBusinessKPIs(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BusinessKPIsDto> {
    this.logger.log(`Getting business KPIs for business ${businessId}`);

    const [
      orderStats,
      orderTimingStats,
      inventoryStats,
      returnedOrders,
      customerCount,
    ] = await Promise.all([
      // Order statistics
      this.prisma.orders.aggregate({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: startDate, lte: endDate },
          status: { not: 'cancelled' },
        },
        _count: { order_id: true },
        _sum: { total_amount: true },
      }),

      // Order processing time statistics
      this.prisma.$queryRaw<
        Array<{
          avg_processing_hours: number;
          shipped_count: bigint;
          total_count: bigint;
        }>
      >`
        SELECT
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::DECIMAL as avg_processing_hours,
          COUNT(CASE WHEN status IN ('shipped', 'delivered') THEN 1 END)::BIGINT as shipped_count,
          COUNT(*)::BIGINT as total_count
        FROM orders
        WHERE business_id = ${businessId}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND created_at >= ${startDate}::timestamp
          AND created_at <= ${endDate}::timestamp
          AND status != 'cancelled'
      `,

      // Inventory statistics for turnover
      this.prisma.$queryRaw<
        Array<{
          avg_inventory_value: number;
          total_sold_value: number;
        }>
      >`
        SELECT
          AVG(il.available_quantity * pv.price)::DECIMAL as avg_inventory_value,
          COALESCE(SUM(
            CASE WHEN im.movement_type IN ('deduct', 'sale')
            THEN ABS(im.quantity_change) * pv.price
            ELSE 0 END
          ), 0)::DECIMAL as total_sold_value
        FROM inventory_levels il
        JOIN product_variants pv ON il.variant_id = pv.variant_id
        LEFT JOIN inventory_movements im ON il.variant_id = im.variant_id
          AND im.business_id = ${businessId}::uuid
          AND im.movement_date >= ${startDate}::timestamp
          AND im.movement_date <= ${endDate}::timestamp
        WHERE il.business_id = ${businessId}::uuid
          AND il.tenant_id = ${tenantId}::uuid
      `,

      // Returned/cancelled orders
      this.prisma.orders.count({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: startDate, lte: endDate },
          status: { in: ['returned', 'refunded'] },
        },
      }),

      // Total customers who placed orders
      this.prisma.orders.findMany({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: startDate, lte: endDate },
          status: { not: 'cancelled' },
        },
        select: { customer_id: true },
        distinct: ['customer_id'],
      }),
    ]);

    // Calculate KPIs
    const totalOrders = orderStats._count.order_id;
    const totalRevenue = Number(orderStats._sum.total_amount || 0);

    // Average Order Value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Order Fulfillment Rate
    const shippedCount = Number(orderTimingStats[0]?.shipped_count || 0);
    const totalCount = Number(orderTimingStats[0]?.total_count || 0);
    const orderFulfillmentRate =
      totalCount > 0 ? (shippedCount / totalCount) * 100 : 0;

    // Average Processing Time
    const averageProcessingTime = Number(
      orderTimingStats[0]?.avg_processing_hours || 0,
    );

    // Return Rate
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

    // Revenue Per Customer
    const uniqueCustomers = customerCount.length;
    const revenuePerCustomer =
      uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;

    // Inventory Turnover Ratio
    const avgInventoryValue = Number(
      inventoryStats[0]?.avg_inventory_value || 0,
    );
    const totalSoldValue = Number(inventoryStats[0]?.total_sold_value || 0);
    const inventoryTurnoverRatio =
      avgInventoryValue > 0 ? totalSoldValue / avgInventoryValue : 0;

    // Conversion Rate (placeholder - would need session tracking data)
    const conversionRate = 0; // TODO: Implement when session tracking is available

    // Customer Acquisition Cost (placeholder - would need marketing spend data)
    const customerAcquisitionCost = 0; // TODO: Implement when marketing data is available

    // Gross Profit Margin (placeholder - would need cost data)
    const grossProfitMargin = 0; // TODO: Implement when product cost data is available

    return {
      conversionRate,
      averageOrderValue,
      customerAcquisitionCost,
      orderFulfillmentRate,
      averageProcessingTime,
      returnRate,
      revenuePerCustomer,
      inventoryTurnoverRatio,
      grossProfitMargin,
    };
  }

  /**
   * Get dashboard summary with all key metrics
   */
  async getDashboardSummary(businessId: string, tenantId: string) {
    this.logger.log(`Getting dashboard summary for business ${businessId}`);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayRevenue,
      weekRevenue,
      monthRevenue,
      orderCounts,
      inventoryMetrics,
      customerMetrics,
      topProducts,
      recentTrends,
    ] = await Promise.all([
      // Today's revenue
      this.prisma.orders.aggregate({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: todayStart },
          status: { not: 'cancelled' },
        },
        _sum: { total_amount: true },
      }),

      // Week revenue
      this.prisma.orders.aggregate({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: weekStart },
          status: { not: 'cancelled' },
        },
        _sum: { total_amount: true },
      }),

      // Month revenue
      this.prisma.orders.aggregate({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          created_at: { gte: monthStart },
          status: { not: 'cancelled' },
        },
        _sum: { total_amount: true },
      }),

      // Order counts by status
      this.prisma.$queryRaw<
        Array<{
          total_orders: bigint;
          pending_orders: bigint;
          completed_orders: bigint;
        }>
      >`
        SELECT
          COUNT(*)::BIGINT as total_orders,
          COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END)::BIGINT as pending_orders,
          COUNT(CASE WHEN status IN ('delivered', 'completed') THEN 1 END)::BIGINT as completed_orders
        FROM orders
        WHERE business_id = ${businessId}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND created_at >= ${monthStart}::timestamp
          AND status != 'cancelled'
      `,

      // Inventory metrics
      this.prisma.$queryRaw<
        Array<{
          total_products: bigint;
          low_stock: bigint;
          out_of_stock: bigint;
          total_value: number;
        }>
      >`
        SELECT
          COUNT(DISTINCT pv.product_id)::BIGINT as total_products,
          COUNT(CASE WHEN il.is_low_stock = true THEN 1 END)::BIGINT as low_stock,
          COUNT(CASE WHEN il.is_out_of_stock = true THEN 1 END)::BIGINT as out_of_stock,
          SUM(il.total_value)::DECIMAL as total_value
        FROM inventory_levels il
        JOIN product_variants pv ON il.variant_id = pv.variant_id
        WHERE il.business_id = ${businessId}::uuid
          AND il.tenant_id = ${tenantId}::uuid
      `,

      // Customer metrics
      this.prisma.$queryRaw<
        Array<{
          total_customers: bigint;
          new_this_month: bigint;
          repeat_customers: bigint;
          top_customer_spend: number;
        }>
      >`
        SELECT
          COUNT(DISTINCT c.customer_id)::BIGINT as total_customers,
          COUNT(DISTINCT CASE WHEN c.created_at >= ${monthStart}::timestamp THEN c.customer_id END)::BIGINT as new_this_month,
          COUNT(DISTINCT CASE WHEN order_counts.order_count > 1 THEN order_counts.customer_id END)::BIGINT as repeat_customers,
          COALESCE(MAX(order_totals.total_spent), 0)::DECIMAL as top_customer_spend
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, COUNT(*) as order_count
          FROM orders
          WHERE business_id = ${businessId}::uuid AND status != 'cancelled'
          GROUP BY customer_id
        ) order_counts ON c.customer_id = order_counts.customer_id
        LEFT JOIN (
          SELECT customer_id, SUM(total_amount) as total_spent
          FROM orders
          WHERE business_id = ${businessId}::uuid AND status != 'cancelled'
          GROUP BY customer_id
        ) order_totals ON c.customer_id = order_totals.customer_id
        WHERE c.business_id = ${businessId}::uuid
          AND c.tenant_id = ${tenantId}::uuid
      `,

      // Top products
      this.prisma.$queryRaw<
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
          AND o.created_at >= ${monthStart}::timestamp
          AND o.status != 'cancelled'
        GROUP BY p.product_id, p.product_name
        ORDER BY quantity_sold DESC
        LIMIT 5
      `,

      // Recent trends (last 7 days)
      this.prisma.$queryRaw<
        Array<{
          date: string;
          revenue: number;
          orders: bigint;
          customers: bigint;
        }>
      >`
        SELECT
          TO_CHAR(o.created_at, 'YYYY-MM-DD') as date,
          SUM(o.total_amount)::DECIMAL as revenue,
          COUNT(o.order_id)::BIGINT as orders,
          COUNT(DISTINCT o.customer_id)::BIGINT as customers
        FROM orders o
        WHERE o.business_id = ${businessId}::uuid
          AND o.created_at >= ${weekStart}::timestamp
          AND o.status != 'cancelled'
        GROUP BY TO_CHAR(o.created_at, 'YYYY-MM-DD')
        ORDER BY date ASC
      `,
    ]);

    return {
      sales: {
        todayRevenue: Number(todayRevenue._sum.total_amount || 0),
        weekRevenue: Number(weekRevenue._sum.total_amount || 0),
        monthRevenue: Number(monthRevenue._sum.total_amount || 0),
        totalOrders: Number(orderCounts[0]?.total_orders || 0),
        pendingOrders: Number(orderCounts[0]?.pending_orders || 0),
        completedOrders: Number(orderCounts[0]?.completed_orders || 0),
      },
      inventory: {
        totalProducts: Number(inventoryMetrics[0]?.total_products || 0),
        lowStockProducts: Number(inventoryMetrics[0]?.low_stock || 0),
        outOfStockProducts: Number(inventoryMetrics[0]?.out_of_stock || 0),
        totalInventoryValue: Number(inventoryMetrics[0]?.total_value || 0),
      },
      customers: {
        totalCustomers: Number(customerMetrics[0]?.total_customers || 0),
        newThisMonth: Number(customerMetrics[0]?.new_this_month || 0),
        repeatCustomers: Number(customerMetrics[0]?.repeat_customers || 0),
        topCustomerSpend: Number(customerMetrics[0]?.top_customer_spend || 0),
      },
      topProducts: topProducts.map((p) => ({
        productId: p.product_id,
        productName: p.product_name,
        quantitySold: Number(p.quantity_sold),
        revenue: Number(p.revenue),
        orderCount: Number(p.order_count),
      })),
      recentTrends: recentTrends.map((t) => ({
        date: t.date,
        revenue: Number(t.revenue),
        orders: Number(t.orders),
        customers: Number(t.customers),
      })),
    };
  }
}
