import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ensures idempotent message processing
 * Prevents duplicate processing of the same AI result
 */
@Injectable()
export class MessageDeduplicatorService {
  private readonly logger = new Logger(MessageDeduplicatorService.name);
  private readonly DEDUPLICATION_TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if message has already been processed
   * @returns true if message is duplicate (should skip), false if new
   */
  async isDuplicate(messageId: string, leadId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.processed_messages.findUnique({
        where: { message_id: messageId },
      });

      if (existing) {
        this.logger.warn(
          `Duplicate message detected: ${messageId} for lead ${leadId}`
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking duplicate:', error);
      // Fail open - allow processing on error to prevent message loss
      return false;
    }
  }

  /**
   * Mark message as processed
   */
  async markAsProcessed(
    messageId: string,
    leadId: string,
    processingResult: 'success' | 'failed' | 'retrying'
  ): Promise<void> {
    try {
      await this.prisma.processed_messages.create({
        data: {
          message_id: messageId,
          lead_id: leadId,
          processing_status: processingResult,
          processed_at: new Date(),
          expires_at: new Date(
            Date.now() + this.DEDUPLICATION_TTL_HOURS * 60 * 60 * 1000
          ),
        },
      });
    } catch (error) {
      this.logger.error('Error marking message as processed:', error);
      // Non-critical error - log and continue
    }
  }

  /**
   * Clean up old processed messages (call via cron)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.processed_messages.deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired message records`);
      return result.count;
    } catch (error) {
      this.logger.error('Error cleaning up expired messages:', error);
      return 0;
    }
  }
}
