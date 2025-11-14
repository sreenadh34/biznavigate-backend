import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerAnalyticsDto } from '../dto/analytics-response.dto';

/**
 * Customer Analytics Service
 * Provides customer segmentation, retention, and lifetime value metrics
 */
@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive customer analytics including RFM segmentation
   */
  async getCustomerAnalytics(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CustomerAnalyticsDto> {
    this.logger.log(`Getting customer analytics for business ${businessId}`);

    // Get all customers for the business
    const totalCustomers = await this.prisma.customers.count({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
      },
    });

    // Get new customers in the period
    const newCustomers = await this.prisma.customers.count({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get customers with order counts
    const customerOrderCounts = await this.prisma.$queryRaw<
      Array<{
        customer_id: string;
        order_count: bigint;
        total_spent: number;
      }>
    >`
      SELECT
        customer_id,
        COUNT(order_id)::BIGINT as order_count,
        SUM(total_amount)::DECIMAL as total_spent
      FROM orders
      WHERE business_id = ${businessId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status != 'cancelled'
      GROUP BY customer_id
    `;

    // Calculate repeat customers (more than 1 order)
    const repeatCustomers = customerOrderCounts.filter(
      (c) => Number(c.order_count) > 1,
    ).length;

    // Calculate average lifetime value
    const totalSpent = customerOrderCounts.reduce(
      (sum, c) => sum + Number(c.total_spent),
      0,
    );
    const averageLifetimeValue =
      customerOrderCounts.length > 0
        ? totalSpent / customerOrderCounts.length
        : 0;

    // Calculate retention rate
    // Customers who made purchases in both current and previous period
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDuration);

    const [currentPeriodCustomers, previousPeriodCustomers] =
      await Promise.all([
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
        this.prisma.orders.findMany({
          where: {
            business_id: businessId,
            tenant_id: tenantId,
            created_at: { gte: previousStartDate, lt: startDate },
            status: { not: 'cancelled' },
          },
          select: { customer_id: true },
          distinct: ['customer_id'],
        }),
      ]);

    const currentCustomerIds = new Set(
      currentPeriodCustomers.map((o) => o.customer_id),
    );
    const previousCustomerIds = new Set(
      previousPeriodCustomers.map((o) => o.customer_id),
    );
    const retainedCustomers = [...currentCustomerIds].filter((id) =>
      previousCustomerIds.has(id),
    ).length;

    const retentionRate =
      previousCustomerIds.size > 0
        ? (retainedCustomers / previousCustomerIds.size) * 100
        : 0;

    // Get top customers
    const topCustomersData = await this.prisma.$queryRaw<
      Array<{
        customer_id: string;
        customer_name: string;
        email: string;
        total_orders: bigint;
        total_spent: number;
        last_order_date: Date;
      }>
    >`
      SELECT
        c.customer_id,
        c.customer_name,
        c.email,
        COUNT(o.order_id)::BIGINT as total_orders,
        SUM(o.total_amount)::DECIMAL as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
        AND o.business_id = ${businessId}::uuid
        AND o.status != 'cancelled'
      WHERE c.business_id = ${businessId}::uuid
        AND c.tenant_id = ${tenantId}::uuid
      GROUP BY c.customer_id, c.customer_name, c.email
      HAVING COUNT(o.order_id) > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `;

    // RFM Segmentation
    const rfmSegmentation = await this.calculateRFMSegmentation(
      businessId,
      tenantId,
    );

    return {
      totalCustomers,
      newCustomers,
      repeatCustomers,
      retentionRate,
      averageLifetimeValue,
      topCustomers: topCustomersData.map((c) => ({
        customerId: c.customer_id,
        customerName: c.customer_name,
        totalOrders: Number(c.total_orders),
        totalSpent: Number(c.total_spent),
        lastOrderDate: c.last_order_date,
      })),
      rfmSegmentation,
    };
  }

  /**
   * Calculate RFM (Recency, Frequency, Monetary) Segmentation
   */
  private async calculateRFMSegmentation(
    businessId: string,
    tenantId: string,
  ) {
    this.logger.log(`Calculating RFM segmentation for business ${businessId}`);

    // Get RFM scores for all customers
    const rfmData = await this.prisma.$queryRaw<
      Array<{
        customer_id: string;
        recency_days: number;
        frequency: bigint;
        monetary: number;
      }>
    >`
      SELECT
        c.customer_id,
        EXTRACT(DAY FROM (NOW() - MAX(o.created_at)))::INTEGER as recency_days,
        COUNT(o.order_id)::BIGINT as frequency,
        SUM(o.total_amount)::DECIMAL as monetary
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
        AND o.business_id = ${businessId}::uuid
        AND o.status != 'cancelled'
      WHERE c.business_id = ${businessId}::uuid
        AND c.tenant_id = ${tenantId}::uuid
      GROUP BY c.customer_id
      HAVING COUNT(o.order_id) > 0
    `;

    if (rfmData.length === 0) {
      return {
        champions: 0,
        loyalCustomers: 0,
        potentialLoyalists: 0,
        recentCustomers: 0,
        promising: 0,
        needsAttention: 0,
        atRisk: 0,
        cantLose: 0,
        hibernating: 0,
        lost: 0,
      };
    }

    // Calculate RFM scores (1-5 scale)
    const recencyValues = rfmData.map((d) => d.recency_days).sort((a, b) => a - b);
    const frequencyValues = rfmData
      .map((d) => Number(d.frequency))
      .sort((a, b) => a - b);
    const monetaryValues = rfmData
      .map((d) => Number(d.monetary))
      .sort((a, b) => a - b);

    const getQuintile = (value: number, sortedArray: number[]): number => {
      const len = sortedArray.length;
      if (value <= sortedArray[Math.floor(len * 0.2)]) return 1;
      if (value <= sortedArray[Math.floor(len * 0.4)]) return 2;
      if (value <= sortedArray[Math.floor(len * 0.6)]) return 3;
      if (value <= sortedArray[Math.floor(len * 0.8)]) return 4;
      return 5;
    };

    // Assign RFM scores and segments
    const segments = {
      champions: 0,
      loyalCustomers: 0,
      potentialLoyalists: 0,
      recentCustomers: 0,
      promising: 0,
      needsAttention: 0,
      atRisk: 0,
      cantLose: 0,
      hibernating: 0,
      lost: 0,
    };

    rfmData.forEach((customer) => {
      // Lower recency is better (inverse scoring)
      const rScore = 6 - getQuintile(customer.recency_days, recencyValues);
      const fScore = getQuintile(Number(customer.frequency), frequencyValues);
      const mScore = getQuintile(Number(customer.monetary), monetaryValues);

      // Segment assignment based on RFM scores
      if (rScore >= 4 && fScore >= 4 && mScore >= 4) {
        segments.champions++;
      } else if (rScore >= 3 && fScore >= 4 && mScore >= 4) {
        segments.loyalCustomers++;
      } else if (rScore >= 4 && fScore <= 2 && mScore >= 3) {
        segments.potentialLoyalists++;
      } else if (rScore >= 4 && fScore <= 2 && mScore <= 2) {
        segments.recentCustomers++;
      } else if (rScore >= 3 && fScore <= 2 && mScore <= 3) {
        segments.promising++;
      } else if (rScore <= 3 && fScore >= 3 && mScore >= 3) {
        segments.needsAttention++;
      } else if (rScore <= 2 && fScore >= 3 && mScore >= 3) {
        segments.atRisk++;
      } else if (rScore <= 2 && fScore >= 4 && mScore >= 4) {
        segments.cantLose++;
      } else if (rScore <= 2 && fScore <= 2 && mScore >= 3) {
        segments.hibernating++;
      } else {
        segments.lost++;
      }
    });

    return segments;
  }

  /**
   * Get customer cohort analysis
   */
  async getCustomerCohortAnalysis(
    businessId: string,
    tenantId: string,
    cohortMonth: Date,
  ) {
    this.logger.log(
      `Getting cohort analysis for business ${businessId}, cohort ${cohortMonth.toISOString()}`,
    );

    // Get customers who made first purchase in cohort month
    const cohortCustomers = await this.prisma.$queryRaw<
      Array<{ customer_id: string }>
    >`
      SELECT DISTINCT ON (customer_id) customer_id
      FROM orders
      WHERE business_id = ${businessId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', ${cohortMonth}::timestamp)
        AND status != 'cancelled'
      ORDER BY customer_id, created_at
    `;

    const customerIds = cohortCustomers.map((c) => c.customer_id);

    if (customerIds.length === 0) {
      return {
        cohortMonth: cohortMonth.toISOString(),
        cohortSize: 0,
        retentionByMonth: [],
      };
    }

    // Calculate retention for next 12 months
    const retentionByMonth = [];
    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(cohortMonth);
      monthDate.setMonth(monthDate.getMonth() + month);
      const nextMonth = new Date(monthDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const activeCustomers = await this.prisma.orders.findMany({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          customer_id: { in: customerIds },
          created_at: {
            gte: monthDate,
            lt: nextMonth,
          },
          status: { not: 'cancelled' },
        },
        select: { customer_id: true },
        distinct: ['customer_id'],
      });

      retentionByMonth.push({
        month,
        activeCustomers: activeCustomers.length,
        retentionRate: (activeCustomers.length / customerIds.length) * 100,
      });
    }

    return {
      cohortMonth: cohortMonth.toISOString(),
      cohortSize: customerIds.length,
      retentionByMonth,
    };
  }

  /**
   * Get customer churn analysis
   */
  async getCustomerChurnAnalysis(
    businessId: string,
    tenantId: string,
    inactiveDays: number = 90,
  ) {
    this.logger.log(
      `Getting churn analysis for business ${businessId}, inactive threshold: ${inactiveDays} days`,
    );

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - inactiveDays);

    // Get churned customers (no orders in last X days)
    const churnedCustomers = await this.prisma.$queryRaw<
      Array<{
        customer_id: string;
        customer_name: string;
        last_order_date: Date;
        total_orders: bigint;
        total_spent: number;
        days_since_last_order: number;
      }>
    >`
      SELECT
        c.customer_id,
        c.customer_name,
        MAX(o.created_at) as last_order_date,
        COUNT(o.order_id)::BIGINT as total_orders,
        SUM(o.total_amount)::DECIMAL as total_spent,
        EXTRACT(DAY FROM (NOW() - MAX(o.created_at)))::INTEGER as days_since_last_order
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
        AND o.business_id = ${businessId}::uuid
        AND o.status != 'cancelled'
      WHERE c.business_id = ${businessId}::uuid
        AND c.tenant_id = ${tenantId}::uuid
      GROUP BY c.customer_id, c.customer_name
      HAVING MAX(o.created_at) < ${inactiveThreshold}::timestamp
      ORDER BY total_spent DESC
    `;

    const totalChurnValue = churnedCustomers.reduce(
      (sum, c) => sum + Number(c.total_spent),
      0,
    );

    return {
      churnedCustomersCount: churnedCustomers.length,
      totalChurnValue,
      averageValuePerChurnedCustomer:
        churnedCustomers.length > 0
          ? totalChurnValue / churnedCustomers.length
          : 0,
      churnedCustomers: churnedCustomers.map((c) => ({
        customerId: c.customer_id,
        customerName: c.customer_name,
        lastOrderDate: c.last_order_date,
        totalOrders: Number(c.total_orders),
        totalSpent: Number(c.total_spent),
        daysSinceLastOrder: c.days_since_last_order,
      })),
    };
  }
}
