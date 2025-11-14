import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DeadLetterMessage {
  messageId: string;
  leadId: string;
  originalPayload: any;
  error: string;
  errorStack?: string;
  attemptCount: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
}

/**
 * Dead Letter Queue for failed message processing
 * Stores messages that failed after all retry attempts
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS_MS = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send message to DLQ after all retries exhausted
   */
  async sendToDeadLetter(message: DeadLetterMessage): Promise<void> {
    try {
      await this.prisma.dead_letter_queue.create({
        data: {
          message_id: message.messageId,
          lead_id: message.leadId,
          original_payload: message.originalPayload as any,
          error_message: message.error,
          error_stack: message.errorStack,
          attempt_count: message.attemptCount,
          first_attempt_at: message.firstAttemptAt,
          last_attempt_at: message.lastAttemptAt,
          status: 'failed',
          created_at: new Date(),
        },
      });

      this.logger.error(
        `Message ${message.messageId} sent to DLQ after ${message.attemptCount} attempts: ${message.error}`
      );

      // Create alert activity for monitoring
      await this.prisma.lead_activities.create({
        data: {
          lead_id: message.leadId,
          business_id: (message.originalPayload as any).business_id,
          tenant_id: (message.originalPayload as any).tenant_id,
          activity_type: 'processing_failed',
          activity_description: `Message processing failed: ${message.error}`,
          actor_type: 'system',
          channel: 'error_handler',
          metadata: {
            messageId: message.messageId,
            attemptCount: message.attemptCount,
            sentToDLQ: true,
          } as any,
          activity_timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send message to DLQ:', error);
      // This is critical - we're losing the error record
      // In production, this should trigger an alert
    }
  }

  /**
   * Get retry delay for attempt number
   */
  getRetryDelay(attemptNumber: number): number {
    const index = Math.min(attemptNumber - 1, this.RETRY_DELAYS_MS.length - 1);
    return this.RETRY_DELAYS_MS[index];
  }

  /**
   * Check if message should be retried
   */
  shouldRetry(attemptCount: number): boolean {
    return attemptCount < this.MAX_RETRY_ATTEMPTS;
  }

  /**
   * Get failed messages for manual review/reprocessing
   */
  async getFailedMessages(limit: number = 100): Promise<any[]> {
    return this.prisma.dead_letter_queue.findMany({
      where: { status: 'failed' },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Retry a specific failed message
   */
  async retryMessage(dlqId: string): Promise<boolean> {
    try {
      const message = await this.prisma.dead_letter_queue.findUnique({
        where: { id: dlqId },
      });

      if (!message) {
        return false;
      }

      // Mark as retrying
      await this.prisma.dead_letter_queue.update({
        where: { id: dlqId },
        data: { status: 'retrying', updated_at: new Date() },
      });

      this.logger.log(`Retrying message ${message.message_id} from DLQ`);
      return true;
    } catch (error) {
      this.logger.error('Error retrying DLQ message:', error);
      return false;
    }
  }

  /**
   * Mark DLQ message as resolved
   */
  async markAsResolved(dlqId: string): Promise<void> {
    await this.prisma.dead_letter_queue.update({
      where: { id: dlqId },
      data: { status: 'resolved', updated_at: new Date() },
    });
  }
}
