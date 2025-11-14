import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { StockReservationService } from '../services/stock-reservation.service';

/**
 * Background Job Processor for Expired Stock Reservations
 * Runs periodically to clean up expired reservations and release stock
 */
@Processor('reservation-cleanup', {
  concurrency: 1, // Only one cleanup job at a time
})
export class ReservationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationCleanupProcessor.name);

  constructor(private readonly stockReservationService: StockReservationService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log('Starting expired reservation cleanup job');

    try {
      const cleanedCount = await this.stockReservationService.cleanupExpiredReservations();

      this.logger.log(`Cleanup job completed. Cleaned ${cleanedCount} expired reservations`);

      return {
        success: true,
        cleanedCount,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Cleanup job failed: ${error.message}`, error.stack);
      throw error; // Job will retry automatically
    }
  }
}
