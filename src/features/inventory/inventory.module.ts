/**
 * Inventory Module
 * Complete inventory management system
 *
 * Features:
 * - Multi-warehouse inventory tracking
 * - Real-time stock levels (available/reserved/damaged/in-transit)
 * - Complete audit trail (stock movements)
 * - Low stock alerts
 * - Inter-warehouse transfers
 * - Transaction-safe operations for high concurrency
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { InventoryController } from './application/controllers/inventory.controller';
import { WarehouseController } from './application/controllers/warehouse.controller';

// Services
import { InventoryService } from './application/services/inventory.service';
import { WarehouseService } from './application/services/warehouse.service';

// Repository
import { InventoryRepositoryPrisma } from './infrastructure/inventory.repository.prisma';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, WarehouseController],
  providers: [
    InventoryService,
    WarehouseService,
    InventoryRepositoryPrisma,
  ],
  exports: [InventoryService, WarehouseService, InventoryRepositoryPrisma],
})
export class InventoryModule {}
