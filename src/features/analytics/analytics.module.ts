import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { SalesAnalyticsService } from './application/services/sales-analytics.service';
import { InventoryAnalyticsService } from './application/services/inventory-analytics.service';
import { CustomerAnalyticsService } from './application/services/customer-analytics.service';
import { BusinessKPIsService } from './application/services/business-kpis.service';

/**
 * Analytics Module
 * Provides comprehensive business analytics and reporting capabilities
 */
@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    SalesAnalyticsService,
    InventoryAnalyticsService,
    CustomerAnalyticsService,
    BusinessKPIsService,
  ],
  exports: [
    SalesAnalyticsService,
    InventoryAnalyticsService,
    CustomerAnalyticsService,
    BusinessKPIsService,
  ],
})
export class AnalyticsModule {}
