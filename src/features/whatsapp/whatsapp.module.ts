import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppOAuthController } from './whatsapp-oauth.controller';
import { WhatsAppCatalogController } from './whatsapp-catalog.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppOAuthService } from './services/whatsapp-oauth.service';
import { WhatsAppCatalogService } from './services/whatsapp-catalog.service';
import { WhatsAppApiClientService } from './infrastructure/whatsapp-api-client.service';
import { WebhookValidatorService } from './infrastructure/webhook-validator.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { ConversationStateService } from './services/conversation-state.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    KafkaModule,
  ],
  controllers: [
    WhatsAppController,
    WhatsAppOAuthController,
    WhatsAppCatalogController,
  ],
  providers: [
    WhatsAppService,
    WhatsAppOAuthService,
    WhatsAppCatalogService,
    WhatsAppApiClientService,
    WebhookValidatorService,
    CircuitBreakerService,
    ConversationStateService,
  ],
  exports: [WhatsAppService, WhatsAppApiClientService, WhatsAppCatalogService],
})
export class WhatsAppModule {}
