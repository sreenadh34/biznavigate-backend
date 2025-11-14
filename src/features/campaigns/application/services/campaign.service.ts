import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignQueryDto,
  SendCampaignDto,
  CampaignStatus,
  AudienceSegmentDto,
} from '../dto/campaign.dto';
import { AudienceSegmentationService } from './audience-segmentation.service';

/**
 * Campaign Service
 * Handles campaign creation, management, and orchestration
 */
@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audienceService: AudienceSegmentationService,
    @InjectQueue('campaign-messages') private campaignQueue: Queue,
  ) {}

  /**
   * Create a new campaign
   */
  async createCampaign(dto: CreateCampaignDto) {
    this.logger.log(`Creating campaign: ${dto.campaignName}`);

    // Get audience count
    const audienceDto: AudienceSegmentDto = {
      businessId: dto.businessId,
      tenantId: dto.tenantId,
      audienceType: dto.audienceType,
      filter: dto.audienceFilter,
    };

    const totalRecipients = await this.audienceService.previewAudienceCount(
      audienceDto,
    );

    if (totalRecipients === 0) {
      throw new BadRequestException(
        'No recipients found for the selected audience',
      );
    }

    // Get product details if product_id is provided
    let mediaUrl = dto.mediaUrl;
    let mediaType = dto.mediaType;

    if (dto.productId && !mediaUrl) {
      const product = await this.prisma.products.findUnique({
        where: { product_id: dto.productId },
        select: { primary_image_url: true, image_urls: true },
      });

      if (product) {
        mediaUrl =
          product.primary_image_url ||
          (product.image_urls as any)?.[0] ||
          null;
        mediaType = mediaUrl ? 'image' : null;
      }
    }

    // Create campaign
    const campaign = await this.prisma.campaigns.create({
      data: {
        business_id: dto.businessId,
        tenant_id: dto.tenantId,
        campaign_name: dto.campaignName,
        campaign_type: dto.campaignType,
        channel: dto.channel,
        status: dto.scheduledAt
          ? CampaignStatus.SCHEDULED
          : CampaignStatus.DRAFT,
        scheduled_at: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        content_template: dto.contentTemplate || null,
        target_segment: dto.audienceFilter || null,
        // New fields from migration
        template_id: dto.templateId || null,
        whatsapp_template_name: dto.whatsappTemplateName || null,
        whatsapp_template_language: dto.whatsappTemplateLanguage || 'en',
        template_parameters: dto.templateParameters || [],
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        product_id: dto.productId || null,
        audience_type: dto.audienceType,
        audience_filter: dto.audienceFilter || {},
        total_recipients: totalRecipients,
        sent_count: 0,
        delivered_count: 0,
        failed_count: 0,
        clicked_count: 0,
        converted_count: 0,
      },
    });

    this.logger.log(`Campaign created: ${campaign.campaign_id}`);

    return {
      ...campaign,
      estimatedReach: totalRecipients,
    };
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string) {
    const campaign = await this.prisma.campaigns.findUnique({
      where: { campaign_id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return campaign;
  }

  /**
   * Get all campaigns with pagination
   */
  async getCampaigns(query: CampaignQueryDto) {
    const { businessId, tenantId, status, channel, page = 1, limit = 20 } = query;

    const where: any = {
      business_id: businessId,
    };

    if (tenantId) {
      where.tenant_id = tenantId;
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    const [campaigns, total] = await Promise.all([
      this.prisma.campaigns.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.campaigns.count({ where }),
    ]);

    return {
      data: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.getCampaign(campaignId);

    // Don't allow updates to sent/completed campaigns
    if (
      [
        CampaignStatus.SENDING,
        CampaignStatus.SENT,
        CampaignStatus.COMPLETED,
      ].includes(campaign.status as any)
    ) {
      throw new BadRequestException(
        'Cannot update campaign that is being sent or completed',
      );
    }

    const updated = await this.prisma.campaigns.update({
      where: { campaign_id: campaignId },
      data: {
        campaign_name: dto.campaignName,
        status: dto.status,
        scheduled_at: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        audience_filter: dto.audienceFilter,
        template_parameters: dto.templateParameters,
        media_url: dto.mediaUrl,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Campaign updated: ${campaignId}`);
    return updated;
  }

  /**
   * Delete campaign (soft delete by setting status to cancelled)
   */
  async deleteCampaign(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);

    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Cannot delete campaign that is being sent');
    }

    await this.prisma.campaigns.update({
      where: { campaign_id: campaignId },
      data: {
        status: CampaignStatus.CANCELLED,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Campaign deleted: ${campaignId}`);
    return { message: 'Campaign cancelled successfully' };
  }

  /**
   * Send campaign immediately
   */
  async sendCampaign(dto: SendCampaignDto) {
    const campaign = await this.getCampaign(dto.campaignId);

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException(
        `Campaign status is ${campaign.status}. Can only send draft or scheduled campaigns`,
      );
    }

    // Update campaign status to sending
    await this.prisma.campaigns.update({
      where: { campaign_id: dto.campaignId },
      data: {
        status: CampaignStatus.SENDING,
        sent_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Get audience
    let audience;
    if (dto.testMode && dto.testRecipients) {
      // Test mode: use provided test recipients
      audience = dto.testRecipients.map((phone, index) => ({
        id: `test-${index}`,
        name: 'Test Recipient',
        phone,
        type: 'test',
      }));
    } else {
      // Production mode: get actual audience
      const audienceDto: AudienceSegmentDto = {
        businessId: campaign.business_id,
        tenantId: campaign.tenant_id,
        audienceType: campaign.audience_type as any,
        filter: campaign.audience_filter as any,
      };
      audience = await this.audienceService.getAudience(audienceDto);
    }

    this.logger.log(
      `Sending campaign ${dto.campaignId} to ${audience.length} recipients`,
    );

    // Create campaign recipients
    const recipients = await Promise.all(
      audience.map(async (contact) => {
        // Get lead_id if it's a lead
        let leadId = null;
        if (contact.type === 'lead') {
          leadId = contact.id;
        } else if (contact.type === 'customer') {
          // Try to find lead by phone
          const lead = await this.prisma.leads.findFirst({
            where: {
              phone: contact.phone,
              business_id: campaign.business_id,
            },
            select: { lead_id: true },
          });
          leadId = lead?.lead_id || null;
        }

        return await this.prisma.campaign_recipients.create({
          data: {
            campaign_id: dto.campaignId,
            lead_id: leadId || dto.campaignId, // Fallback to campaign_id if no lead
            status: 'pending',
          },
        });
      }),
    );

    // Queue messages for delivery via BullMQ
    const jobs = recipients.map((recipient, index) => ({
      name: `campaign-${dto.campaignId}-recipient-${recipient.recipient_id}`,
      data: {
        campaignId: dto.campaignId,
        recipientId: recipient.recipient_id,
        contact: audience[index],
        campaign: {
          businessId: campaign.business_id,
          tenantId: campaign.tenant_id,
          channel: campaign.channel,
          templateName: campaign.whatsapp_template_name,
          templateLanguage: campaign.whatsapp_template_language,
          templateParameters: campaign.template_parameters,
          mediaUrl: campaign.media_url,
          mediaType: campaign.media_type,
          contentTemplate: campaign.content_template,
        },
      },
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Remove after 24 hours
          count: 1000, // Keep last 1000
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    }));

    // Add jobs to queue in batches
    const batchSize = 100;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      await this.campaignQueue.addBulk(batch);
      this.logger.log(`Queued batch ${i / batchSize + 1} of ${Math.ceil(jobs.length / batchSize)}`);
    }

    this.logger.log(
      `Successfully queued ${jobs.length} messages for campaign ${dto.campaignId}`,
    );

    return {
      campaignId: dto.campaignId,
      status: 'sending',
      totalRecipients: audience.length,
      queued: jobs.length,
      message: `Campaign is being sent to ${audience.length} recipients`,
    };
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);

    const stats = await this.prisma.campaign_recipients.groupBy({
      by: ['status'],
      where: { campaign_id: campaignId },
      _count: { status: true },
    });

    const statusCounts: Record<string, number> = {};
    stats.forEach((stat) => {
      statusCounts[stat.status || 'unknown'] = stat._count.status;
    });

    const totalRecipients = campaign.total_recipients || 0;
    const sentCount = campaign.sent_count || 0;
    const deliveredCount = campaign.delivered_count || 0;
    const failedCount = campaign.failed_count || 0;
    const clickedCount = campaign.clicked_count || 0;
    const convertedCount = campaign.converted_count || 0;

    return {
      campaignId,
      campaignName: campaign.campaign_name,
      status: campaign.status,
      totalRecipients,
      sentCount,
      deliveredCount,
      failedCount,
      clickedCount,
      convertedCount,
      deliveryRate:
        sentCount > 0 ? ((deliveredCount / sentCount) * 100).toFixed(2) : '0.00',
      clickRate:
        deliveredCount > 0
          ? ((clickedCount / deliveredCount) * 100).toFixed(2)
          : '0.00',
      conversionRate:
        clickedCount > 0
          ? ((convertedCount / clickedCount) * 100).toFixed(2)
          : '0.00',
      statusBreakdown: statusCounts,
      createdAt: campaign.created_at,
      sentAt: campaign.sent_at,
      completedAt: campaign.completed_at,
    };
  }

  /**
   * Preview audience for a campaign
   */
  async previewAudience(
    businessId: string,
    tenantId: string,
    audienceType: string,
    audienceFilter?: any,
  ) {
    const audienceDto: AudienceSegmentDto = {
      businessId,
      tenantId,
      audienceType: audienceType as any,
      filter: audienceFilter,
    };

    const [totalCount, sample] = await Promise.all([
      this.audienceService.previewAudienceCount(audienceDto),
      this.audienceService.getSampleAudience(audienceDto, 10),
    ]);

    return {
      totalCount,
      audienceType,
      sample: sample.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      })),
    };
  }
}
