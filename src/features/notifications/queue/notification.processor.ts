import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationService } from '../application/services/notification.service';

/**
 * Notification Queue Processor
 * Processes async notification jobs from BullMQ
 */
@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'send-notification':
          return await this.processSendNotification(job);
        case 'retry-failed-notifications':
          return await this.processRetryFailed(job);
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process single notification send job
   */
  private async processSendNotification(job: Job<{ notificationId: string }>): Promise<void> {
    const { notificationId } = job.data;

    this.logger.log(`Sending notification ${notificationId}`);

    try {
      await this.notificationService.sendImmediately(notificationId);
      this.logger.log(`Notification ${notificationId} sent successfully`);
    } catch (error) {
      this.logger.error(`Failed to send notification ${notificationId}: ${error.message}`);
      throw error; // Will trigger retry
    }
  }

  /**
   * Process retry of failed notifications
   */
  private async processRetryFailed(job: Job): Promise<void> {
    this.logger.log('Retrying failed notifications...');

    const failedNotifications = await this.notificationService.findByStatus('failed');

    for (const notification of failedNotifications) {
      if (notification.retry_count < notification.max_retries) {
        try {
          await this.notificationService.sendImmediately(notification.notification_id);
        } catch (error) {
          this.logger.error(
            `Retry failed for notification ${notification.notification_id}: ${error.message}`,
          );
        }
      }
    }

    this.logger.log(`Processed ${failedNotifications.length} failed notifications`);
  }
}
