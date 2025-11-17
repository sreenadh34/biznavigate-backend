import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { InstagramController } from './instagram.controller';
import { FacebookOAuthController } from './facebook-oauth.controller';
import { InstagramService } from './instagram.service';
import { InstagramApiClientService } from './infrastructure/instagram-api-client.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { WebhookValidatorService } from './infrastructure/webhook-validator.service';
import { TokenRefreshProcessor } from './jobs/token-refresh.processor';
import { InsightsSyncProcessor } from './jobs/insights-sync.processor';
import { InstagramSchedulerService } from './jobs/instagram-scheduler.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { KafkaModule } from '../kafka/kafka.module';
import instagramConfig from '../../config/instagram.config';

@Module({
  imports: [
    ConfigModule.forFeature(instagramConfig),
    PrismaModule,
    KafkaModule,
    BullModule.registerQueue(
      {
        name: 'instagram-token-refresh',
      },
      {
        name: 'instagram-insights-sync',
      },
    ),
  ],
  controllers: [InstagramController, FacebookOAuthController],
  providers: [
    InstagramService,
    InstagramApiClientService,
    CircuitBreakerService,
    WebhookValidatorService,
    TokenRefreshProcessor,
    InsightsSyncProcessor,
    InstagramSchedulerService,
  ],
  exports: [InstagramService],
})
export class InstagramModule {}
