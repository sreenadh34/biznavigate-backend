import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { CampaignsController } from './controllers/campaigns.controller';
import { CampaignService } from './application/services/campaign.service';
import { AudienceSegmentationService } from './application/services/audience-segmentation.service';
import { WhatsAppSenderService } from './application/services/whatsapp-sender.service';
import { CampaignMessageProcessor } from './processors/campaign-message.processor';

/**
 * Campaigns Module
 * Provides marketing campaign management with audience targeting and WhatsApp delivery
 *
 * Features:
 * - Audience segmentation (leads, customers, custom segments)
 * - WhatsApp Business API integration with approved templates
 * - Product/image integration for campaigns
 * - Scalable message delivery via BullMQ (handles thousands of messages)
 * - Rate limiting to comply with WhatsApp API limits
 * - Campaign analytics and tracking
 *
 * Updated: Prisma client regenerated with new campaign fields
 */
@Module({
  imports: [
    PrismaModule,
    // Register BullMQ queue for campaign messages
    BullModule.registerQueue({
      name: 'campaign-messages',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 1000,
        },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignService,
    AudienceSegmentationService,
    WhatsAppSenderService,
    CampaignMessageProcessor,
  ],
  exports: [
    CampaignService,
    AudienceSegmentationService,
    WhatsAppSenderService,
  ],
})
export class CampaignsModule {}
