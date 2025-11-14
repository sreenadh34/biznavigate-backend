import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { NotificationController } from './application/controllers/notification.controller';

// Services
import { NotificationService } from './application/services/notification.service';
import { EmailService } from './infrastructure/email.service';
import { SmsService } from './infrastructure/sms.service';
import { WhatsAppService } from './infrastructure/whatsapp.service';
import { TemplateEngineService } from './infrastructure/template-engine.service';

// Repository
import { NotificationRepositoryPrisma } from './infrastructure/notification.repository.prisma';

// Queue Processor
import { NotificationProcessor } from './queue/notification.processor';

/**
 * Notifications Module
 * Multi-channel notification system (Email, SMS, WhatsApp, Push)
 *
 * Features:
 * - Template-based notifications
 * - Multi-channel support
 * - Async processing with BullMQ
 * - Delivery tracking
 * - User preferences
 * - Retry logic
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationController],
  providers: [
    // Services
    NotificationService,
    EmailService,
    SmsService,
    WhatsAppService,
    TemplateEngineService,

    // Repository
    NotificationRepositoryPrisma,

    // Queue Processor
    NotificationProcessor,
  ],
  exports: [
    NotificationService,
    NotificationRepositoryPrisma,
    EmailService,
    SmsService,
    WhatsAppService,
  ],
})
export class NotificationsModule {}
