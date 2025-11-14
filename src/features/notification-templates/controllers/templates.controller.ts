import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TemplateService } from '../application/services/template.service';
import { TemplateValidationService } from '../application/services/template-validation.service';
import { TemplatePreviewService } from '../application/services/template-preview.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateFilterDto,
  TemplatePreviewDto,
  SendTestNotificationDto,
  CloneTemplateDto,
  BulkTemplateActionDto,
  NotificationChannel,
} from '../application/dto/template.dto';

/**
 * Notification Templates Controller
 * Manages notification templates for multi-channel communication
 */
@ApiTags('Notification Templates')
@ApiBearerAuth()
@Controller('notification-templates')
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly validationService: TemplateValidationService,
    private readonly previewService: TemplatePreviewService,
  ) {}

  /**
   * Create a new notification template
   */
  @Post()
  @ApiOperation({
    summary: 'Create notification template',
    description:
      'Create a new multi-channel notification template with variables and validation',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
    schema: {
      example: {
        templateId: 'template-uuid-here',
        templateKey: 'order_confirmation',
        templateName: 'Order Confirmation',
        businessId: 'business-uuid',
        enabledChannels: ['email', 'whatsapp'],
        variables: [
          {
            key: 'customerName',
            label: 'Customer Name',
            type: 'text',
            required: true,
          },
        ],
        isActive: true,
        createdAt: '2024-11-03T12:00:00Z',
        validation: {
          isValid: true,
          warnings: [],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid template data' })
  @ApiResponse({ status: 409, description: 'Template key already exists' })
  async createTemplate(@Body() dto: CreateTemplateDto) {
    this.logger.log(`Creating template: ${dto.templateKey} for business: ${dto.businessId}`);
    return this.templateService.createTemplate(dto);
  }

  /**
   * List templates with filtering and pagination
   */
  @Get()
  @ApiOperation({
    summary: 'List notification templates',
    description: 'Get paginated list of templates with filtering options',
  })
  @ApiQuery({ name: 'businessId', required: false, description: 'Filter by business ID' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'templateKey', required: false, description: 'Filter by template key' })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: NotificationChannel,
    description: 'Filter by channel',
  })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'isSystem', required: false, description: 'Filter by system template' })
  @ApiQuery({ name: 'search', required: false, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    schema: {
      example: {
        templates: [
          {
            templateId: 'template-uuid-1',
            templateKey: 'order_confirmation',
            templateName: 'Order Confirmation',
            enabledChannels: ['email', 'whatsapp'],
            isActive: true,
            createdAt: '2024-11-03T12:00:00Z',
          },
        ],
        pagination: {
          total: 45,
          page: 1,
          limit: 20,
          totalPages: 3,
        },
      },
    },
  })
  async listTemplates(@Query() filters: TemplateFilterDto) {
    this.logger.log(`Listing templates with filters: ${JSON.stringify(filters)}`);
    return this.templateService.listTemplates(filters);
  }

  /**
   * Get template by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get template by ID',
    description: 'Retrieve a single template with full details',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template retrieved successfully',
    schema: {
      example: {
        templateId: 'template-uuid',
        templateKey: 'order_confirmation',
        templateName: 'Order Confirmation',
        description: 'Sent when customer places an order',
        emailSubject: 'Your Order #{{orderNumber}} has been confirmed!',
        emailBody: 'Hi {{customerName}}, thank you for your order!',
        emailHtml: '<h1>Thank you {{customerName}}!</h1>',
        smsBody: 'Hi {{customerName}}! Your order #{{orderNumber}} is confirmed.',
        whatsappBody: 'Hello {{customerName}}! Your order is confirmed.',
        pushTitle: 'Order Confirmed',
        pushBody: 'Your order #{{orderNumber}} is confirmed!',
        variables: [
          {
            key: 'customerName',
            label: 'Customer Name',
            type: 'text',
            required: true,
            exampleValue: 'John Doe',
          },
          {
            key: 'orderNumber',
            label: 'Order Number',
            type: 'text',
            required: true,
            exampleValue: 'ORD-12345',
          },
        ],
        enabledChannels: ['email', 'sms', 'whatsapp', 'push'],
        isActive: true,
        isSystem: false,
        createdAt: '2024-11-03T12:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateById(@Param('id') id: string) {
    this.logger.log(`Getting template: ${id}`);
    return this.templateService.getTemplateById(id);
  }

  /**
   * Get template by business and key
   */
  @Get('by-key/:businessId/:key')
  @ApiOperation({
    summary: 'Get template by business and key',
    description: 'Retrieve a template using business ID and template key',
  })
  @ApiParam({ name: 'businessId', description: 'Business UUID' })
  @ApiParam({ name: 'key', description: 'Template key (e.g., order_confirmation)' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateByKey(
    @Param('businessId') businessId: string,
    @Param('key') key: string,
  ) {
    this.logger.log(`Getting template by key: ${key} for business: ${businessId}`);
    return this.templateService.getTemplateByKey(businessId, key);
  }

  /**
   * Update template
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update notification template',
    description: 'Update an existing template. System templates cannot be modified.',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
    schema: {
      example: {
        templateId: 'template-uuid',
        templateName: 'Order Confirmation V2',
        updatedAt: '2024-11-03T14:30:00Z',
        validation: {
          isValid: true,
          warnings: [],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid template data' })
  @ApiResponse({ status: 403, description: 'Cannot modify system template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    this.logger.log(`Updating template: ${id}`);
    return this.templateService.updateTemplate(id, dto);
  }

  /**
   * Delete template
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification template',
    description:
      'Delete a template. System templates and templates used in campaigns cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete system template or template in use' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Param('id') id: string) {
    this.logger.log(`Deleting template: ${id}`);
    await this.templateService.deleteTemplate(id);
  }

  /**
   * Clone template
   */
  @Post('clone')
  @ApiOperation({
    summary: 'Clone notification template',
    description: 'Create a copy of an existing template with a new key and name',
  })
  @ApiResponse({
    status: 201,
    description: 'Template cloned successfully',
    schema: {
      example: {
        templateId: 'new-template-uuid',
        templateKey: 'order_confirmation_v2',
        templateName: 'Order Confirmation V2',
        sourceTemplateId: 'original-template-uuid',
        isActive: false,
        createdAt: '2024-11-03T12:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Source template not found' })
  @ApiResponse({ status: 409, description: 'New template key already exists' })
  async cloneTemplate(@Body() dto: CloneTemplateDto) {
    this.logger.log(`Cloning template: ${dto.sourceTemplateId} to ${dto.newTemplateKey}`);
    // TODO: Get userId from JWT token in production
    const userId = 'user-from-jwt-token';
    return this.templateService.cloneTemplate(dto, userId);
  }

  /**
   * Bulk template actions
   */
  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk template actions',
    description: 'Perform bulk actions on multiple templates (activate, deactivate, delete)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk action completed',
    schema: {
      example: {
        action: 'activate',
        total: 5,
        successful: 5,
        failed: 0,
        results: [
          {
            templateId: 'template-uuid-1',
            success: true,
          },
          {
            templateId: 'template-uuid-2',
            success: true,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid bulk action' })
  async bulkAction(@Body() dto: BulkTemplateActionDto) {
    this.logger.log(`Bulk action: ${dto.action} on ${dto.templateIds.length} templates`);
    return this.templateService.bulkAction(dto);
  }

  /**
   * Validate template
   */
  @Get(':id/validate')
  @ApiOperation({
    summary: 'Validate notification template',
    description:
      'Check template for errors, warnings, and variable consistency across all channels',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Validation completed',
    schema: {
      example: {
        isValid: true,
        errors: [],
        warnings: ['Variable {{discount}} is defined but not used in any channel'],
        detectedVariables: ['customerName', 'orderNumber'],
        missingDefinitions: [],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async validateTemplate(@Param('id') id: string) {
    this.logger.log(`Validating template: ${id}`);
    return this.templateService.validateTemplate(id);
  }

  /**
   * Get template statistics
   */
  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get template statistics',
    description: 'Get usage statistics and performance metrics for a template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        templateId: 'template-uuid',
        templateName: 'Order Confirmation',
        campaignUsageCount: 12,
        totalSent: 15234,
        totalDelivered: 15102,
        totalFailed: 132,
        totalClicked: 3421,
        totalConverted: 892,
        deliveryRate: 99.13,
        clickRate: 22.65,
        conversionRate: 5.90,
        lastUsed: '2024-11-02T15:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateStats(@Param('id') id: string) {
    this.logger.log(`Getting stats for template: ${id}`);
    return this.templateService.getTemplateStats(id);
  }

  /**
   * Get active templates for business
   */
  @Get('business/:businessId/active')
  @ApiOperation({
    summary: 'Get active templates for business',
    description: 'Get all active templates for a business, optionally filtered by channel',
  })
  @ApiParam({ name: 'businessId', description: 'Business UUID' })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: NotificationChannel,
    description: 'Filter by channel',
  })
  @ApiResponse({
    status: 200,
    description: 'Active templates retrieved',
    schema: {
      example: [
        {
          templateId: 'template-uuid-1',
          templateKey: 'order_confirmation',
          templateName: 'Order Confirmation',
          enabledChannels: ['email', 'whatsapp'],
        },
        {
          templateId: 'template-uuid-2',
          templateKey: 'password_reset',
          templateName: 'Password Reset',
          enabledChannels: ['email', 'sms'],
        },
      ],
    },
  })
  async getActiveTemplates(
    @Param('businessId') businessId: string,
    @Query('channel') channel?: NotificationChannel,
  ) {
    this.logger.log(
      `Getting active templates for business: ${businessId}${channel ? ` for channel: ${channel}` : ''}`,
    );
    return this.templateService.getActiveTemplatesForBusiness(businessId, channel);
  }

  /**
   * Preview template
   */
  @Post('preview')
  @ApiOperation({
    summary: 'Preview notification template',
    description: 'Generate a preview of the template with provided variables',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview generated successfully',
    schema: {
      example: {
        channel: 'whatsapp',
        templateId: 'template-uuid',
        templateName: 'Order Confirmation',
        body: 'Hello John Doe! Your order #ORD-12345 has been confirmed.',
        variables: {
          customerName: 'John Doe',
          orderNumber: 'ORD-12345',
        },
        detectedVariables: ['customerName', 'orderNumber'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid variables provided' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async previewTemplate(@Body() dto: TemplatePreviewDto) {
    this.logger.log(`Previewing template: ${dto.templateId} for channel: ${dto.channel}`);
    return this.previewService.previewTemplate(dto);
  }

  /**
   * Get sample preview
   */
  @Get(':id/sample-preview/:channel')
  @ApiOperation({
    summary: 'Get sample preview',
    description: 'Preview template using example values from variable definitions',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiParam({
    name: 'channel',
    enum: NotificationChannel,
    description: 'Notification channel',
  })
  @ApiResponse({
    status: 200,
    description: 'Sample preview generated',
    schema: {
      example: {
        channel: 'email',
        subject: 'Your Order #ORD-12345 has been confirmed!',
        body: 'Hi John Doe, thank you for your order!',
        html: '<h1>Thank you John Doe!</h1>',
        variables: {
          customerName: 'John Doe',
          orderNumber: 'ORD-12345',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getSamplePreview(@Param('id') id: string, @Param('channel') channel: NotificationChannel) {
    this.logger.log(`Getting sample preview for template: ${id} on channel: ${channel}`);
    return this.previewService.getSamplePreview(id, channel);
  }

  /**
   * Send test notification
   */
  @Post('test')
  @ApiOperation({
    summary: 'Send test notification',
    description: 'Send a test notification to verify template rendering and delivery',
  })
  @ApiResponse({
    status: 200,
    description: 'Test notification queued',
    schema: {
      example: {
        success: true,
        message: 'Test notification queued for whatsapp',
        recipient: '+919876543210',
        preview: {
          channel: 'whatsapp',
          body: 'Hello John Doe! Your order #ORD-12345 has been confirmed.',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid test data or missing recipient' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async sendTestNotification(@Body() dto: SendTestNotificationDto) {
    this.logger.log(`Sending test notification for template: ${dto.templateId}`);
    return this.previewService.sendTestNotification(dto);
  }

  /**
   * Batch preview
   */
  @Post(':id/batch-preview')
  @ApiOperation({
    summary: 'Batch preview templates',
    description: 'Preview template with multiple variable sets for testing',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Batch preview completed',
    schema: {
      example: {
        total: 3,
        successful: 3,
        failed: 0,
        previews: [
          {
            success: true,
            preview: {
              channel: 'email',
              subject: 'Order #ORD-001 confirmed',
              body: 'Hi Alice...',
            },
          },
          {
            success: true,
            preview: {
              channel: 'email',
              subject: 'Order #ORD-002 confirmed',
              body: 'Hi Bob...',
            },
          },
        ],
      },
    },
  })
  async batchPreview(
    @Param('id') id: string,
    @Body() body: { channel: NotificationChannel; variableSets: Record<string, any>[] },
  ) {
    this.logger.log(`Batch preview for template: ${id} with ${body.variableSets.length} sets`);
    return this.previewService.batchPreview(id, body.channel, body.variableSets);
  }

  /**
   * Compare templates
   */
  @Post('compare')
  @ApiOperation({
    summary: 'Compare two templates',
    description: 'Compare two templates side-by-side for A/B testing',
  })
  @ApiResponse({
    status: 200,
    description: 'Comparison completed',
    schema: {
      example: {
        template1: {
          channel: 'email',
          subject: 'Order Confirmed - Version A',
          body: 'Hi John, your order is confirmed!',
        },
        template2: {
          channel: 'email',
          subject: 'Order Confirmed - Version B',
          body: 'Hello John! Your order has been confirmed.',
        },
        comparison: {
          channel: 'email',
          differences: {
            subject: {
              template1: 'Order Confirmed - Version A',
              template2: 'Order Confirmed - Version B',
            },
            body: {
              template1: 'Hi John, your order is confirmed!',
              template2: 'Hello John! Your order has been confirmed.',
              lengthDiff: 10,
            },
          },
        },
      },
    },
  })
  async compareTemplates(
    @Body()
    body: {
      templateId1: string;
      templateId2: string;
      channel: NotificationChannel;
      variables: Record<string, any>;
    },
  ) {
    this.logger.log(`Comparing templates: ${body.templateId1} vs ${body.templateId2}`);
    return this.previewService.compareTemplates(
      body.templateId1,
      body.templateId2,
      body.channel,
      body.variables,
    );
  }

  /**
   * Export template
   */
  @Get(':id/export')
  @ApiOperation({
    summary: 'Export template as JSON',
    description: 'Export template configuration for backup or migration',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template exported successfully',
    schema: {
      example: {
        version: '1.0',
        exportedAt: '2024-11-03T12:00:00Z',
        template: {
          templateKey: 'order_confirmation',
          templateName: 'Order Confirmation',
          description: 'Sent when customer places an order',
          emailSubject: 'Your Order #{{orderNumber}} confirmed!',
          emailBody: 'Hi {{customerName}}...',
          variables: [],
          enabledChannels: ['email', 'whatsapp'],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async exportTemplate(@Param('id') id: string) {
    this.logger.log(`Exporting template: ${id}`);
    return this.previewService.exportTemplate(id);
  }
}
