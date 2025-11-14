import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InventoryAnalyticsDto } from '../dto/analytics-response.dto';

/**
 * Inventory Analytics Service
 * Provides inventory health metrics, turnover rates, and stock insights
 */
@Injectable()
export class InventoryAnalyticsService {
  private readonly logger = new Logger(InventoryAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive inventory analytics
   */
  async getInventoryAnalytics(
    businessId: string,
    tenantId: string,
  ): Promise<InventoryAnalyticsDto> {
    this.logger.log(`Getting inventory analytics for business ${businessId}`);

    const [inventoryLevels, lowStockProducts, topValueProducts, warehouseSummary] =
      await Promise.all([
        // Get all inventory levels
        this.prisma.inventory_levels.findMany({
          where: {
            business_id: businessId,
            tenant_id: tenantId,
          },
          include: {
            product_variants: {
              include: {
                product: true,
              },
            },
          },
        }),

        // Count low stock products
        this.prisma.inventory_levels.count({
          where: {
            business_id: businessId,
            tenant_id: tenantId,
            available_quantity: {
              lte: this.prisma.inventory_levels.fields.reorder_point,
            },
            reorder_point: {
              not: null,
            },
          },
        }),

        // Top products by stock value
        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            product_name: string;
            stock_value: number;
            quantity: bigint;
          }>
        >`
          SELECT
            p.product_id,
            p.product_name,
            SUM(il.available_quantity * pv.price)::DECIMAL as stock_value,
            SUM(il.available_quantity)::BIGINT as quantity
          FROM inventory_levels il
          JOIN product_variants pv ON il.variant_id = pv.variant_id
          JOIN products p ON pv.product_id = p.product_id
          WHERE il.business_id = ${businessId}::uuid
            AND il.tenant_id = ${tenantId}::uuid
          GROUP BY p.product_id, p.product_name
          ORDER BY stock_value DESC
          LIMIT 10
        `,

        // Warehouse-wise inventory summary
        this.prisma.$queryRaw<
          Array<{
            warehouse_id: string;
            warehouse_name: string;
            total_value: number;
            total_units: bigint;
          }>
        >`
          SELECT
            w.warehouse_id,
            w.warehouse_name,
            SUM(il.available_quantity * pv.price)::DECIMAL as total_value,
            SUM(il.available_quantity)::BIGINT as total_units
          FROM inventory_levels il
          JOIN warehouses w ON il.warehouse_id = w.warehouse_id
          JOIN product_variants pv ON il.variant_id = pv.variant_id
          WHERE il.business_id = ${businessId}::uuid
            AND il.tenant_id = ${tenantId}::uuid
          GROUP BY w.warehouse_id, w.warehouse_name
          ORDER BY total_value DESC
        `,
      ]);

    // Calculate total inventory value and units
    let totalInventoryValue = 0;
    let totalStockUnits = 0;
    let outOfStockCount = 0;

    inventoryLevels.forEach((level) => {
      const price = level.product_variants?.price || 0;
      totalInventoryValue += level.available_quantity * Number(price);
      totalStockUnits += level.available_quantity;

      if (level.available_quantity === 0) {
        outOfStockCount++;
      }
    });

    // Calculate average turnover rate (simplified - based on last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inventoryMovements = await this.prisma.stock_movements.aggregate({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
        movement_type: { in: ['deduct', 'sale'] },
        created_at: { gte: thirtyDaysAgo },
      },
      _sum: {
        quantity_change: true,
      },
    });

    const totalSoldLast30Days = Math.abs(inventoryMovements._sum.quantity_change || 0);
    const averageTurnoverRate =
      totalStockUnits > 0 ? (totalSoldLast30Days / totalStockUnits) * 12 : 0; // Annualized

    return {
      totalInventoryValue,
      totalStockUnits,
      lowStockCount: lowStockProducts,
      outOfStockCount,
      averageTurnoverRate,
      topProductsByValue: topValueProducts.map((p) => ({
        productId: p.product_id,
        productName: p.product_name,
        stockValue: Number(p.stock_value),
        quantity: Number(p.quantity),
      })),
      warehouseInventory: warehouseSummary.map((w) => ({
        warehouseId: w.warehouse_id,
        warehouseName: w.warehouse_name,
        totalValue: Number(w.total_value),
        totalUnits: Number(w.total_units),
      })),
    };
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(businessId: string, tenantId: string) {
    this.logger.log(`Getting low stock alerts for business ${businessId}`);

    const lowStockItems = await this.prisma.inventory_levels.findMany({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
        available_quantity: {
          lte: this.prisma.inventory_levels.fields.reorder_point,
        },
        reorder_point: {
          not: null,
        },
      },
      include: {
        product_variants: {
          include: {
            product: true,
          },
        },
        warehouses: true,
      },
      orderBy: {
        available_quantity: 'asc',
      },
    });

    return lowStockItems.map((item) => ({
      productId: item.product_variants?.product?.product_id,
      productName: item.product_variants?.product?.name,
      variantId: item.variant_id,
      variantName: item.product_variants?.name,
      warehouseId: item.warehouse_id,
      warehouseName: item.warehouses?.warehouse_name,
      currentStock: item.available_quantity,
      reorderPoint: item.reorder_point,
      reorderQuantity: item.reorder_quantity,
      severity: item.available_quantity === 0 ? 'critical' : 'warning',
    }));
  }

  /**
   * Get inventory turnover by product
   */
  async getInventoryTurnoverByProduct(
    businessId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    this.logger.log(`Getting inventory turnover by product for business ${businessId}`);

    const turnoverData = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        product_name: string;
        total_sold: bigint;
        avg_stock: number;
        turnover_rate: number;
      }>
    >`
      SELECT
        p.product_id,
        p.product_name,
        ABS(SUM(CASE WHEN im.movement_type IN ('deduct', 'sale') THEN im.quantity_change ELSE 0 END))::BIGINT as total_sold,
        AVG(il.available_quantity)::DECIMAL as avg_stock,
        CASE
          WHEN AVG(il.available_quantity) > 0 THEN
            ABS(SUM(CASE WHEN im.movement_type IN ('deduct', 'sale') THEN im.quantity_change ELSE 0 END)) / AVG(il.available_quantity)
          ELSE 0
        END::DECIMAL as turnover_rate
      FROM inventory_movements im
      JOIN product_variants pv ON im.variant_id = pv.variant_id
      JOIN products p ON pv.product_id = p.product_id
      LEFT JOIN inventory_levels il ON im.variant_id = il.variant_id AND im.warehouse_id = il.warehouse_id
      WHERE im.business_id = ${businessId}::uuid
        AND im.tenant_id = ${tenantId}::uuid
        AND im.created_at >= ${startDate}::timestamp
        AND im.created_at <= ${endDate}::timestamp
      GROUP BY p.product_id, p.product_name
      HAVING ABS(SUM(CASE WHEN im.movement_type IN ('deduct', 'sale') THEN im.quantity_change ELSE 0 END)) > 0
      ORDER BY turnover_rate DESC
      LIMIT 20
    `;

    return turnoverData.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      totalSold: Number(item.total_sold),
      averageStock: Number(item.avg_stock),
      turnoverRate: Number(item.turnover_rate),
    }));
  }
}
