import { ApiProperty } from '@nestjs/swagger';

/**
 * Sales Analytics Response
 */
export class SalesAnalyticsDto {
  @ApiProperty({ description: 'Total revenue in the period' })
  totalRevenue: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Total number of items sold' })
  totalItemsSold: number;

  @ApiProperty({ description: 'Revenue growth compared to previous period (percentage)' })
  revenueGrowth: number;

  @ApiProperty({ description: 'Orders growth compared to previous period (percentage)' })
  ordersGrowth: number;

  @ApiProperty({ description: 'Daily revenue breakdown', type: [Object] })
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;

  @ApiProperty({ description: 'Orders by status', type: Object })
  ordersByStatus: Record<string, number>;
}

/**
 * Top Product Item
 */
export class TopProductDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Total quantity sold' })
  quantitySold: number;

  @ApiProperty({ description: 'Total revenue from this product' })
  revenue: number;

  @ApiProperty({ description: 'Number of orders containing this product' })
  orderCount: number;
}

/**
 * Inventory Analytics Response
 */
export class InventoryAnalyticsDto {
  @ApiProperty({ description: 'Total inventory value (cost)' })
  totalInventoryValue: number;

  @ApiProperty({ description: 'Total stock units across all warehouses' })
  totalStockUnits: number;

  @ApiProperty({ description: 'Number of low stock products' })
  lowStockCount: number;

  @ApiProperty({ description: 'Number of out of stock products' })
  outOfStockCount: number;

  @ApiProperty({ description: 'Average inventory turnover rate' })
  averageTurnoverRate: number;

  @ApiProperty({ description: 'Top products by stock value', type: [Object] })
  topProductsByValue: Array<{
    productId: string;
    productName: string;
    stockValue: number;
    quantity: number;
  }>;

  @ApiProperty({ description: 'Warehouse-wise inventory summary', type: [Object] })
  warehouseInventory: Array<{
    warehouseId: string;
    warehouseName: string;
    totalValue: number;
    totalUnits: number;
  }>;
}

/**
 * Customer Analytics Response
 */
export class CustomerAnalyticsDto {
  @ApiProperty({ description: 'Total number of customers' })
  totalCustomers: number;

  @ApiProperty({ description: 'New customers in the period' })
  newCustomers: number;

  @ApiProperty({ description: 'Repeat customers (placed more than one order)' })
  repeatCustomers: number;

  @ApiProperty({ description: 'Customer retention rate (percentage)' })
  retentionRate: number;

  @ApiProperty({ description: 'Average customer lifetime value' })
  averageLifetimeValue: number;

  @ApiProperty({ description: 'Top customers by revenue', type: [Object] })
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: Date;
  }>;

  @ApiProperty({ description: 'Customer segmentation by RFM', type: Object })
  rfmSegmentation: {
    champions: number;
    loyalCustomers: number;
    potentialLoyalists: number;
    recentCustomers: number;
    promising: number;
    needsAttention: number;
    atRisk: number;
    cantLose: number;
    hibernating: number;
    lost: number;
  };
}

/**
 * Business KPIs Response
 */
export class BusinessKPIsDto {
  @ApiProperty({ description: 'Conversion rate (orders / total sessions, if tracked)' })
  conversionRate: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Customer acquisition cost (if marketing data available)' })
  customerAcquisitionCost: number;

  @ApiProperty({ description: 'Order fulfillment rate (shipped / total orders)' })
  orderFulfillmentRate: number;

  @ApiProperty({ description: 'Average order processing time (hours)' })
  averageProcessingTime: number;

  @ApiProperty({ description: 'Return rate (returned orders / total orders)' })
  returnRate: number;

  @ApiProperty({ description: 'Revenue per customer' })
  revenuePerCustomer: number;

  @ApiProperty({ description: 'Inventory turnover ratio' })
  inventoryTurnoverRatio: number;

  @ApiProperty({ description: 'Gross profit margin (if cost data available)' })
  grossProfitMargin: number;
}

/**
 * Dashboard Summary Response - All key metrics in one
 */
export class DashboardSummaryDto {
  @ApiProperty({ description: 'Sales metrics' })
  sales: {
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
  };

  @ApiProperty({ description: 'Inventory metrics' })
  inventory: {
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalInventoryValue: number;
  };

  @ApiProperty({ description: 'Customer metrics' })
  customers: {
    totalCustomers: number;
    newThisMonth: number;
    repeatCustomers: number;
    topCustomerSpend: number;
  };

  @ApiProperty({ description: 'Top performing products', type: [TopProductDto] })
  topProducts: TopProductDto[];

  @ApiProperty({ description: 'Recent trends', type: [Object] })
  recentTrends: Array<{
    date: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
}
