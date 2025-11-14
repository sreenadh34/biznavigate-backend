import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './application/controllers/order.controller';
import { OrderService } from './application/services/order.service';
import { StockReservationService } from './application/services/stock-reservation.service';
import { ReservationCleanupScheduler } from './application/services/reservation-cleanup.scheduler';
import { OrderRepositoryPrisma } from './infrastructure/order.repository.prisma';
import { ReservationCleanupProcessor } from './application/jobs/reservation-cleanup.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Orders Module
 * Handles all order management functionality with production-ready stock reservation
 * Dependencies: PrismaModule, CustomersModule, BullMQ
 */
@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'reservation-cleanup',
    }),
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderRepositoryPrisma,
    StockReservationService,
    ReservationCleanupScheduler,
    ReservationCleanupProcessor,
  ],
  exports: [OrderService, OrderRepositoryPrisma, StockReservationService],
})
export class OrdersModule {}
