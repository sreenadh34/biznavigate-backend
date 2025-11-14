import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Scheduler for Reservation Cleanup Jobs
 * Adds recurring jobs to clean up expired stock reservations
 */
@Injectable()
export class ReservationCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(ReservationCleanupScheduler.name);
  private readonly CLEANUP_INTERVAL_MINUTES = 5; // Run every 5 minutes

  constructor(
    @InjectQueue('reservation-cleanup')
    private readonly cleanupQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      // Add recurring job that runs every 5 minutes
      await this.cleanupQueue.add(
        'cleanup-expired-reservations',
        {}, // No data needed
        {
          repeat: {
            pattern: `*/${this.CLEANUP_INTERVAL_MINUTES} * * * *`, // Cron: every 5 minutes
          },
          removeOnComplete: true, // Clean up job history
          removeOnFail: false, // Keep failed jobs for debugging
        },
      );

      this.logger.log(
        `Reservation cleanup job scheduled to run every ${this.CLEANUP_INTERVAL_MINUTES} minutes`,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule cleanup job: ${error.message}`, error.stack);
    }
  }
}
