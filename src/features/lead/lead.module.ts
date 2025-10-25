import { Module } from '@nestjs/common';
import { LeadController } from './controllers/lead.controller';
import { LeadService } from './application/services/lead.service';
import { LeadActivityService } from './application/services/lead-activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaModule } from '../kafka/kafka.module';

/**
 * Lead Module
 * Handles all lead management functionality including:
 * - Lead CRUD operations
 * - Lead assignment
 * - Status tracking
 * - Activity logging
 * - Statistics and reporting
 * - Bulk import
 * - Kafka integration for AI processing
 */
@Module({
  imports: [KafkaModule], // Import Kafka module for AI integration
  controllers: [LeadController],
  providers: [LeadService, LeadActivityService, PrismaService],
  exports: [LeadService, LeadActivityService],
})
export class LeadModule {}
