import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateFilterDto,
  CloneTemplateDto,
  BulkTemplateActionDto,
  NotificationChannel,
  TemplateValidationResultDto,
} from '../dto/template.dto';
import { TemplateValidationService } from './template-validation.service';

/**
 * Template Service
 * Handles all template CRUD operations with validation and versioning
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: TemplateValidationService,
  ) {}

  /**
   * Create a new template
   */
  async createTemplate(dto: CreateTemplateDto) {
    this.logger.log(`Creating template: ${dto.templateKey}`);

    // Check if template key already exists for this business
    const existing = await this.prisma.notification_templates.findFirst({
      where: {
        business_id: dto.businessId,
        template_key: dto.templateKey,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Template with key '${dto.templateKey}' already exists for this business`,
      );
    }

    // Validate template
    const validation = this.validationService.validateTemplate(
      dto.emailSubject,
      dto.emailBody,
      dto.emailHtml,
      dto.smsBody,
      dto.whatsappBody,
      dto.pushTitle,
      dto.pushBody,
      dto.variables,
      dto.enabledChannels,
    );

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Template validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Create template
    const template = await this.prisma.notification_templates.create({
      data: {
        business_id: dto.businessId,
        tenant_id: dto.tenantId,
        template_key: dto.templateKey,
        template_name: dto.templateName,
        description: dto.description,
        email_subject: dto.emailSubject,
        email_body: dto.emailBody,
        email_html: dto.emailHtml,
        sms_body: dto.smsBody,
        whatsapp_body: dto.whatsappBody,
        push_title: dto.pushTitle,
        push_body: dto.pushBody,
        variables: dto.variables as any,
        enabled_channels: dto.enabledChannels as any,
        is_active: dto.isActive ?? true,
        is_system: dto.isSystem ?? false,
        created_by: dto.createdBy,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Template created successfully: ${template.template_id}`);

    return {
      ...template,
      validation: {
        warnings: validation.warnings,
        detectedVariables: validation.detectedVariables,
      },
    };
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string) {
    const template = await this.prisma.notification_templates.findUnique({
      where: { template_id: templateId },
      include: {
        businesses: {
          select: {
            business_id: true,
            business_name: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    return template;
  }

  /**
   * Get template by key
   */
  async getTemplateByKey(businessId: string, templateKey: string) {
    const template = await this.prisma.notification_templates.findFirst({
      where: {
        business_id: businessId,
        template_key: templateKey,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template with key '${templateKey}' not found for this business`,
      );
    }

    return template;
  }

  /**
   * List templates with filters and pagination
   */
  async listTemplates(filters: TemplateFilterDto) {
    const { page = 1, limit = 20, search, channel, ...restFilters } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (restFilters.businessId) {
      where.business_id = restFilters.businessId;
    }

    if (restFilters.tenantId) {
      where.tenant_id = restFilters.tenantId;
    }

    if (restFilters.templateKey) {
      where.template_key = restFilters.templateKey;
    }

    if (restFilters.isActive !== undefined) {
      where.is_active = restFilters.isActive;
    }

    if (restFilters.isSystem !== undefined) {
      where.is_system = restFilters.isSystem;
    }

    // Filter by channel
    if (channel) {
      where.enabled_channels = {
        path: '$',
        array_contains: channel,
      };
    }

    // Search across name, key, and description
    if (search) {
      where.OR = [
        { template_name: { contains: search, mode: 'insensitive' } },
        { template_key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.notification_templates.count({ where });

    // Get templates
    const templates = await this.prisma.notification_templates.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        businesses: {
          select: {
            business_id: true,
            business_name: true,
          },
        },
      },
    });

    return {
      templates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, dto: UpdateTemplateDto) {
    this.logger.log(`Updating template: ${templateId}`);

    // Check if template exists
    const existing = await this.getTemplateById(templateId);

    // Prevent editing system templates
    if (existing.is_system) {
      throw new BadRequestException('System templates cannot be modified');
    }

    // If template key is being changed, check for conflicts
    if (dto.templateKey && dto.templateKey !== existing.template_key) {
      const conflict = await this.prisma.notification_templates.findFirst({
        where: {
          business_id: existing.business_id,
          template_key: dto.templateKey,
          template_id: { not: templateId },
        },
      });

      if (conflict) {
        throw new ConflictException(`Template key '${dto.templateKey}' already exists`);
      }
    }

    // Validate if content is being updated
    if (
      dto.emailSubject ||
      dto.emailBody ||
      dto.emailHtml ||
      dto.smsBody ||
      dto.whatsappBody ||
      dto.pushTitle ||
      dto.pushBody ||
      dto.variables ||
      dto.enabledChannels
    ) {
      const validation = this.validationService.validateTemplate(
        dto.emailSubject ?? existing.email_subject,
        dto.emailBody ?? existing.email_body,
        dto.emailHtml ?? existing.email_html,
        dto.smsBody ?? existing.sms_body,
        dto.whatsappBody ?? existing.whatsapp_body,
        dto.pushTitle ?? existing.push_title,
        dto.pushBody ?? existing.push_body,
        (dto.variables as any) ?? (existing.variables as any),
        (dto.enabledChannels as any) ?? (existing.enabled_channels as any),
      );

      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Template validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }
    }

    // Update template
    const updated = await this.prisma.notification_templates.update({
      where: { template_id: templateId },
      data: {
        ...(dto.templateKey && { template_key: dto.templateKey }),
        ...(dto.templateName && { template_name: dto.templateName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.emailSubject !== undefined && { email_subject: dto.emailSubject }),
        ...(dto.emailBody !== undefined && { email_body: dto.emailBody }),
        ...(dto.emailHtml !== undefined && { email_html: dto.emailHtml }),
        ...(dto.smsBody !== undefined && { sms_body: dto.smsBody }),
        ...(dto.whatsappBody !== undefined && { whatsapp_body: dto.whatsappBody }),
        ...(dto.pushTitle !== undefined && { push_title: dto.pushTitle }),
        ...(dto.pushBody !== undefined && { push_body: dto.pushBody }),
        ...(dto.variables && { variables: dto.variables as any }),
        ...(dto.enabledChannels && { enabled_channels: dto.enabledChannels as any }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Template updated successfully: ${templateId}`);

    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string) {
    this.logger.log(`Deleting template: ${templateId}`);

    const template = await this.getTemplateById(templateId);

    // Prevent deleting system templates
    if (template.is_system) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    // Check if template is used in any campaigns
    const campaignsCount = await this.prisma.campaigns.count({
      where: { template_id: templateId },
    });

    if (campaignsCount > 0) {
      throw new BadRequestException(
        `Template is used in ${campaignsCount} campaign(s) and cannot be deleted. Deactivate it instead.`,
      );
    }

    await this.prisma.notification_templates.delete({
      where: { template_id: templateId },
    });

    this.logger.log(`Template deleted successfully: ${templateId}`);

    return { message: 'Template deleted successfully' };
  }

  /**
   * Clone template
   */
  async cloneTemplate(dto: CloneTemplateDto, userId: string) {
    this.logger.log(`Cloning template: ${dto.sourceTemplateId}`);

    const source = await this.getTemplateById(dto.sourceTemplateId);

    // Check if new key already exists
    const existing = await this.prisma.notification_templates.findFirst({
      where: {
        business_id: source.business_id,
        template_key: dto.newTemplateKey,
      },
    });

    if (existing) {
      throw new ConflictException(`Template key '${dto.newTemplateKey}' already exists`);
    }

    // Create cloned template
    const cloned = await this.prisma.notification_templates.create({
      data: {
        business_id: source.business_id,
        tenant_id: source.tenant_id,
        template_key: dto.newTemplateKey,
        template_name: dto.newTemplateName,
        description: `Cloned from ${source.template_name}`,
        email_subject: source.email_subject,
        email_body: source.email_body,
        email_html: source.email_html,
        sms_body: source.sms_body,
        whatsapp_body: source.whatsapp_body,
        push_title: source.push_title,
        push_body: source.push_body,
        variables: source.variables,
        enabled_channels: source.enabled_channels,
        is_active: dto.copyAsActive ?? false,
        is_system: false, // Clones are never system templates
        created_by: userId,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Template cloned successfully: ${cloned.template_id}`);

    return cloned;
  }

  /**
   * Bulk actions on templates
   */
  async bulkAction(dto: BulkTemplateActionDto) {
    this.logger.log(`Performing bulk action: ${dto.action} on ${dto.templateIds.length} templates`);

    // Verify all templates exist and are not system templates
    const templates = await this.prisma.notification_templates.findMany({
      where: {
        template_id: { in: dto.templateIds },
      },
    });

    if (templates.length !== dto.templateIds.length) {
      throw new BadRequestException('One or more template IDs are invalid');
    }

    const systemTemplates = templates.filter((t) => t.is_system);
    if (systemTemplates.length > 0 && dto.action === 'delete') {
      throw new BadRequestException(
        `Cannot delete system templates: ${systemTemplates.map((t) => t.template_key).join(', ')}`,
      );
    }

    let result;

    switch (dto.action) {
      case 'activate':
        result = await this.prisma.notification_templates.updateMany({
          where: { template_id: { in: dto.templateIds } },
          data: {
            is_active: true,
            updated_at: new Date(),
          },
        });
        break;

      case 'deactivate':
        result = await this.prisma.notification_templates.updateMany({
          where: { template_id: { in: dto.templateIds } },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });
        break;

      case 'delete':
        const nonSystemIds = templates.filter((t) => !t.is_system).map((t) => t.template_id);
        result = await this.prisma.notification_templates.deleteMany({
          where: { template_id: { in: nonSystemIds } },
        });
        break;
    }

    this.logger.log(`Bulk action completed: ${dto.action}`);

    return {
      message: `Bulk ${dto.action} completed successfully`,
      affected: result.count,
    };
  }

  /**
   * Validate template
   */
  async validateTemplate(templateId: string): Promise<TemplateValidationResultDto> {
    const template = await this.getTemplateById(templateId);

    return this.validationService.validateTemplate(
      template.email_subject,
      template.email_body,
      template.email_html,
      template.sms_body,
      template.whatsapp_body,
      template.push_title,
      template.push_body,
      template.variables as any,
      template.enabled_channels as any,
    );
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(templateId: string) {
    const template = await this.getTemplateById(templateId);

    // Count campaigns using this template
    const campaignsCount = await this.prisma.campaigns.count({
      where: { template_id: templateId },
    });

    // Count active campaigns
    const activeCampaignsCount = await this.prisma.campaigns.count({
      where: {
        template_id: templateId,
        status: 'active',
      },
    });

    // Get campaign performance metrics
    const campaigns = await this.prisma.campaigns.findMany({
      where: { template_id: templateId },
      select: {
        sent_count: true,
        delivered_count: true,
        failed_count: true,
        clicked_count: true,
        converted_count: true,
      },
    });

    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered_count || 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.clicked_count || 0), 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + (c.converted_count || 0), 0);

    return {
      templateId: template.template_id,
      templateName: template.template_name,
      templateKey: template.template_key,
      isActive: template.is_active,
      usage: {
        totalCampaigns: campaignsCount,
        activeCampaigns: activeCampaignsCount,
      },
      performance: {
        totalSent,
        totalDelivered,
        totalFailed,
        totalClicked,
        totalConverted,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
        clickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
        conversionRate: totalClicked > 0 ? (totalConverted / totalClicked) * 100 : 0,
      },
      enabledChannels: template.enabled_channels,
      variablesCount: (template.variables as any[])?.length || 0,
    };
  }

  /**
   * Get all templates for a business (for campaign selection)
   */
  async getActiveTemplatesForBusiness(businessId: string, channel?: NotificationChannel) {
    const where: any = {
      business_id: businessId,
      is_active: true,
    };

    if (channel) {
      where.enabled_channels = {
        path: '$',
        array_contains: channel,
      };
    }

    return this.prisma.notification_templates.findMany({
      where,
      select: {
        template_id: true,
        template_key: true,
        template_name: true,
        description: true,
        enabled_channels: true,
        variables: true,
      },
      orderBy: {
        template_name: 'asc',
      },
    });
  }
}
