import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InstagramService } from '../instagram.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Processor('instagram-token-refresh')
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(
    private readonly instagramService: InstagramService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing token refresh job: ${job.id}`);

    try {
      // Get all Instagram accounts with tokens expiring in less than 7 days
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + 7);

      const accountsToRefresh = await this.prisma.social_accounts.findMany({
        where: {
          platform: 'instagram',
          is_active: true,
          token_expiry: {
            lte: expiryThreshold,
          },
        },
      });

      this.logger.log(`Found ${accountsToRefresh.length} accounts requiring token refresh`);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (const account of accountsToRefresh) {
        try {
          await this.instagramService.refreshAccessToken(account.account_id);
          results.success++;
          this.logger.log(`Token refreshed for account ${account.username}`);
        } catch (error) {
          results.failed++;
          results.errors.push({
            accountId: account.account_id,
            username: account.username,
            error: error.message,
          });
          this.logger.error(`Failed to refresh token for ${account.username}:`, error);
        }
      }

      this.logger.log(
        `Token refresh job completed: ${results.success} succeeded, ${results.failed} failed`,
      );

      return results;
    } catch (error) {
      this.logger.error('Token refresh job failed:', error);
      throw error;
    }
  }
}
