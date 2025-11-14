import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TemplatesController } from './controllers/templates.controller';
import { TemplateService } from './application/services/template.service';
import { TemplateValidationService } from './application/services/template-validation.service';
import { TemplatePreviewService } from './application/services/template-preview.service';

/**
 * Notification Templates Module
 * Production-ready multi-channel notification template management
 *
 * Features:
 * - Multi-channel support: Email, SMS, WhatsApp, Push notifications
 * - Dynamic variable system with type validation
 * - Template validation and preview
 * - Test notification sending
 * - Template cloning and versioning
 * - Bulk operations (activate, deactivate, delete)
 * - Campaign integration and usage tracking
 * - A/B testing with template comparison
 * - Template statistics and performance metrics
 * - Export/import functionality
 * - System template protection
 *
 * Architecture:
 * - TemplateService: Core CRUD operations and business logic
 * - TemplateValidationService: Variable and content validation
 * - TemplatePreviewService: Rendering, preview, and testing
 * - TemplatesController: RESTful API endpoints with Swagger docs
 *
 * Usage:
 * Import this module in app.module.ts to enable template management
 */
@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController],
  providers: [TemplateService, TemplateValidationService, TemplatePreviewService],
  exports: [TemplateService, TemplateValidationService, TemplatePreviewService],
})
export class TemplatesModule {}
