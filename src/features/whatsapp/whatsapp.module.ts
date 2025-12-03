import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppApiClientService } from './infrastructure/whatsapp-api-client.service';
import { TwilioClientService } from './infrastructure/twilio-client.service';
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
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppApiClientService,
    TwilioClientService,
    WebhookValidatorService,
    CircuitBreakerService,
    ConversationStateService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
