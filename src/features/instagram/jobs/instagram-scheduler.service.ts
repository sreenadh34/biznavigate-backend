import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class InstagramSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InstagramSchedulerService.name);

  constructor(
    @InjectQueue('instagram-token-refresh') private tokenRefreshQueue: Queue,
    @InjectQueue('instagram-insights-sync') private insightsSyncQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Instagram Scheduler Service initialized');
    await this.setupScheduledJobs();
  }

  /**
   * Setup recurring jobs
   */
  private async setupScheduledJobs() {
    try {
      // Token Refresh Job - Runs daily at 2 AM
      await this.tokenRefreshQueue.add(
        'refresh-tokens',
        {},
        {
          repeat: {
            pattern: '0 2 * * *', // Cron: 2 AM every day
          },
          jobId: 'instagram-token-refresh-daily',
        },
      );
      this.logger.log('Token refresh job scheduled (daily at 2 AM)');

      // Insights Sync Job - Runs every hour
      await this.insightsSyncQueue.add(
        'sync-insights',
        {},
        {
          repeat: {
            pattern: '0 * * * *', // Cron: Every hour
          },
          jobId: 'instagram-insights-sync-hourly',
        },
      );
      this.logger.log('Insights sync job scheduled (hourly)');
    } catch (error) {
      this.logger.error('Failed to setup scheduled jobs:', error);
    }
  }

  /**
   * Manually trigger token refresh
   */
  async triggerTokenRefresh() {
    await this.tokenRefreshQueue.add('refresh-tokens', {}, { priority: 1 });
    this.logger.log('Token refresh job triggered manually');
  }

  /**
   * Manually trigger insights sync
   */
  async triggerInsightsSync() {
    await this.insightsSyncQueue.add('sync-insights', {}, { priority: 1 });
    this.logger.log('Insights sync job triggered manually');
  }

  /**
   * Get job status
   */
  async getJobStatus() {
    const tokenRefreshCounts = await this.tokenRefreshQueue.getJobCounts();
    const insightsSyncCounts = await this.insightsSyncQueue.getJobCounts();

    return {
      tokenRefresh: tokenRefreshCounts,
      insightsSync: insightsSyncCounts,
    };
  }
}
