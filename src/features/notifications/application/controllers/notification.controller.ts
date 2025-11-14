import { Controller, Post, Get, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { NotificationService } from '../services/notification.service';
import { NotificationRepositoryPrisma } from '../../infrastructure/notification.repository.prisma';
import {
  SendNotificationDto,
  SendMultiChannelNotificationDto,
  SendBulkNotificationDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdatePreferenceDto,
} from '../dtos';

/**
 * Notification Controller
 * REST API endpoints for notification management
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly repository: NotificationRepositoryPrisma,
  ) {}

  /**
   * Send a single notification
   * POST /notifications/send
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async send(@Body() dto: SendNotificationDto) {
    const result = await this.notificationService.send(dto);
    return {
      success: true,
      message: 'Notification sent successfully',
      data: result,
    };
  }

  /**
   * Send multi-channel notification
   * POST /notifications/send/multi-channel
   */
  @Post('send/multi-channel')
  @HttpCode(HttpStatus.CREATED)
  async sendMultiChannel(@Body() dto: SendMultiChannelNotificationDto) {
    const result = await this.notificationService.sendMultiChannel(dto);
    return {
      success: true,
      message: 'Multi-channel notifications sent',
      data: result,
    };
  }

  /**
   * Send bulk notifications
   * POST /notifications/send/bulk
   */
  @Post('send/bulk')
  @HttpCode(HttpStatus.CREATED)
  async sendBulk(@Body() dto: SendBulkNotificationDto) {
    const result = await this.notificationService.sendBulk(dto);
    return {
      success: true,
      message: `Bulk notifications processed. ${result.successful} sent, ${result.failed} failed.`,
      data: result,
    };
  }

  /**
   * Get notification by ID
   * GET /notifications/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string) {
    const notification = await this.repository.findMessageById(id);
    return {
      success: true,
      data: notification,
    };
  }

  /**
   * Get notifications by status
   * GET /notifications?status=pending
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getByStatus(@Query('status') status: string) {
    const notifications = await this.repository.findMessagesByStatus(status);
    return {
      success: true,
      data: notifications,
      count: notifications.length,
    };
  }

  /**
   * Get notification events/logs
   * GET /notifications/:id/events
   */
  @Get(':id/events')
  @HttpCode(HttpStatus.OK)
  async getEvents(@Param('id') id: string) {
    const events = await this.repository.findEventsByNotificationId(id);
    return {
      success: true,
      data: events,
      count: events.length,
    };
  }

  // ========================================
  // TEMPLATE MANAGEMENT
  // ========================================

  /**
   * Create notification template
   * POST /notifications/templates
   */
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(@Body() dto: CreateTemplateDto) {
    const template = await this.repository.createTemplate(dto);
    return {
      success: true,
      message: 'Template created successfully',
      data: template,
    };
  }

  /**
   * Get all active templates
   * GET /notifications/templates?business_id=xxx
   */
  @Get('templates/list')
  @HttpCode(HttpStatus.OK)
  async getTemplates(@Query('business_id') businessId?: string) {
    const templates = await this.repository.findActiveTemplates(businessId);
    return {
      success: true,
      data: templates,
      count: templates.length,
    };
  }

  /**
   * Get template by ID
   * GET /notifications/templates/:id
   */
  @Get('templates/:id')
  @HttpCode(HttpStatus.OK)
  async getTemplateById(@Param('id') id: string) {
    const template = await this.repository.findTemplateById(id);
    return {
      success: true,
      data: template,
    };
  }

  /**
   * Update template
   * PUT /notifications/templates/:id
   */
  @Put('templates/:id')
  @HttpCode(HttpStatus.OK)
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const template = await this.repository.updateTemplate(id, dto);
    return {
      success: true,
      message: 'Template updated successfully',
      data: template,
    };
  }

  /**
   * Delete template
   * DELETE /notifications/templates/:id
   */
  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(@Param('id') id: string) {
    await this.repository.deleteTemplate(id);
    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  // ========================================
  // PREFERENCE MANAGEMENT
  // ========================================

  /**
   * Get customer notification preferences
   * GET /notifications/preferences/customer/:customerId
   */
  @Get('preferences/customer/:customerId')
  @HttpCode(HttpStatus.OK)
  async getCustomerPreferences(
    @Param('customerId') customerId: string,
    @Query('business_id') businessId?: string,
  ) {
    const preferences = await this.repository.findPreferenceByCustomer(customerId, businessId);
    return {
      success: true,
      data: preferences,
    };
  }

  /**
   * Update customer preferences
   * PUT /notifications/preferences/customer/:customerId
   */
  @Put('preferences/customer/:customerId')
  @HttpCode(HttpStatus.OK)
  async updateCustomerPreferences(
    @Param('customerId') customerId: string,
    @Body() dto: UpdatePreferenceDto,
  ) {
    // Get existing or create new
    let existing = await this.repository.findPreferenceByCustomer(
      customerId,
      dto.business_id,
    );

    if (existing) {
      const updated = await this.repository.updatePreference(existing.preference_id, dto as any);
      return {
        success: true,
        message: 'Preferences updated successfully',
        data: updated,
      };
    } else {
      const created = await this.repository.createPreference({
        ...dto,
        customer_id: customerId,
      } as any);
      return {
        success: true,
        message: 'Preferences created successfully',
        data: created,
      };
    }
  }

  /**
   * Test notification sending (for development)
   * POST /notifications/test
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testNotification(@Body() dto: SendNotificationDto) {
    try {
      const result = await this.notificationService.send(dto);
      return {
        success: true,
        message: 'Test notification sent',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Test notification failed',
        error: error.message,
      };
    }
  }
}
