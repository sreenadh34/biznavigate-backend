import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InstagramService } from '../instagram.service';
import { InstagramApiClientService } from '../infrastructure/instagram-api-client.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';

@Processor('instagram-insights-sync')
export class InsightsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InsightsSyncProcessor.name);

  constructor(
    private readonly instagramService: InstagramService,
    private readonly apiClient: InstagramApiClientService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing insights sync job: ${job.id}`);

    try {
      // Get all active Instagram accounts
      const accounts = await this.prisma.social_accounts.findMany({
        where: {
          platform: 'instagram',
          is_active: true,
        },
      });

      this.logger.log(`Syncing insights for ${accounts.length} accounts`);

      const results = {
        accountsSynced: 0,
        mediaSynced: 0,
        failed: 0,
        errors: [] as any[],
      };

      for (const account of accounts) {
        try {
          // Sync account info (followers, media count)
          await this.instagramService.syncAccountInfo(account.account_id);

          // Sync recent media
          const accessToken = this.decryptToken(account.access_token);
          const mediaList = await this.circuitBreaker.execute(() =>
            this.apiClient.getMediaList(account.platform_user_id, accessToken, 25),
          );

          // Cache media in database
          if (mediaList.data) {
            for (const media of mediaList.data) {
              await this.prisma.instagram_media.upsert({
                where: { media_id: media.id },
                create: {
                  media_id: media.id,
                  account_id: account.account_id,
                  media_type: media.media_type,
                  media_url: media.media_url,
                  thumbnail_url: media.thumbnail_url,
                  caption: media.caption,
                  permalink: media.permalink,
                  timestamp: new Date(media.timestamp),
                  like_count: media.like_count,
                  comment_count: media.comments_count,
                  owner_username: media.username,
                },
                update: {
                  like_count: media.like_count,
                  comment_count: media.comments_count,
                  updated_at: new Date(),
                },
              });
              results.mediaSynced++;
            }
          }

          results.accountsSynced++;
          this.logger.log(`Insights synced for account ${account.username}`);
        } catch (error) {
          results.failed++;
          results.errors.push({
            accountId: account.account_id,
            username: account.username,
            error: error.message,
          });
          this.logger.error(`Failed to sync insights for ${account.username}:`, error);
        }
      }

      this.logger.log(
        `Insights sync job completed: ${results.accountsSynced} accounts, ${results.mediaSynced} media items synced, ${results.failed} failed`,
      );

      return results;
    } catch (error) {
      this.logger.error('Insights sync job failed:', error);
      throw error;
    }
  }

  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-cbc';
    const appSecret = process.env.INSTAGRAM_APP_SECRET || '';
    const key = crypto.scryptSync(appSecret, 'salt', 32);
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
