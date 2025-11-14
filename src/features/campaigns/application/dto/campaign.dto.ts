import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsInt,
  IsDateString,
  IsUrl,
  IsNotEmpty,
  Min,
  IsBoolean,
} from 'class-validator';

// Enums
export enum CampaignType {
  PROMOTIONAL = 'promotional',
  TRANSACTIONAL = 'transactional',
  NOTIFICATION = 'notification',
  ANNOUNCEMENT = 'announcement',
}

export enum CampaignChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AudienceType {
  ALL = 'all',
  LEADS = 'leads',
  CUSTOMERS = 'customers',
  SEGMENT = 'segment',
  CUSTOM = 'custom',
}

export enum RecipientStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CLICKED = 'clicked',
  CONVERTED = 'converted',
}

/**
 * Create Campaign DTO
 */
export class CreateCampaignDto {
  @ApiProperty({ description: 'Business ID' })
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  @IsNotEmpty()
  campaignName: string;

  @ApiProperty({ enum: CampaignType, description: 'Type of campaign' })
  @IsEnum(CampaignType)
  @IsNotEmpty()
  campaignType: CampaignType;

  @ApiProperty({ enum: CampaignChannel, description: 'Communication channel' })
  @IsEnum(CampaignChannel)
  @IsNotEmpty()
  channel: CampaignChannel;

  @ApiProperty({ enum: AudienceType, description: 'Target audience type' })
  @IsEnum(AudienceType)
  @IsNotEmpty()
  audienceType: AudienceType;

  @ApiPropertyOptional({ description: 'Audience filter criteria (JSON)' })
  @IsOptional()
  @IsObject()
  audienceFilter?: any;

  @ApiPropertyOptional({ description: 'WhatsApp approved template name' })
  @IsOptional()
  @IsString()
  whatsappTemplateName?: string;

  @ApiPropertyOptional({ description: 'WhatsApp template language code', default: 'en' })
  @IsOptional()
  @IsString()
  whatsappTemplateLanguage?: string;

  @ApiPropertyOptional({ description: 'Template parameters (array of values)' })
  @IsOptional()
  @IsArray()
  templateParameters?: any[];

  @ApiPropertyOptional({ description: 'Notification template ID for reusable templates' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Media URL (image/video)' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'Media type: image, video, document' })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiPropertyOptional({ description: 'Product ID for product-based campaigns' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Custom content/message' })
  @IsOptional()
  @IsString()
  contentTemplate?: string;

  @ApiPropertyOptional({ description: 'Schedule campaign for later' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

/**
 * Update Campaign DTO
 */
export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign name' })
  @IsOptional()
  @IsString()
  campaignName?: string;

  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Campaign status' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Schedule campaign for later' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Audience filter criteria (JSON)' })
  @IsOptional()
  @IsObject()
  audienceFilter?: any;

  @ApiPropertyOptional({ description: 'Template parameters' })
  @IsOptional()
  @IsArray()
  templateParameters?: any[];

  @ApiPropertyOptional({ description: 'Media URL' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;
}

/**
 * Campaign Query DTO
 */
export class CampaignQueryDto {
  @ApiProperty({ description: 'Business ID' })
  @IsUUID()
  businessId: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ enum: CampaignChannel, description: 'Filter by channel' })
  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

/**
 * Audience Segmentation DTO
 */
export class AudienceSegmentDto {
  @ApiProperty({ description: 'Business ID' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ enum: AudienceType, description: 'Audience type' })
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @ApiPropertyOptional({ description: 'Segment filter (for custom audiences)' })
  @IsOptional()
  @IsObject()
  filter?: {
    leadStatus?: string[];
    leadQuality?: string[];
    tags?: string[];
    minEngagementScore?: number;
    maxEngagementScore?: number;
    minTotalSpent?: number;
    maxTotalSpent?: number;
    minOrders?: number;
    maxOrders?: number;
    lastOrderDaysAgo?: number;
    city?: string[];
    state?: string[];
  };
}

/**
 * Send Campaign DTO (immediate send)
 */
export class SendCampaignDto {
  @ApiProperty({ description: 'Campaign ID to send' })
  @IsUUID()
  campaignId: string;

  @ApiPropertyOptional({ description: 'Send to test recipients only', default: false })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean = false;

  @ApiPropertyOptional({ description: 'Test recipient phone numbers (for test mode)' })
  @IsOptional()
  @IsArray()
  testRecipients?: string[];
}

/**
 * WhatsApp Template DTO
 */
export class WhatsAppTemplateDto {
  @ApiProperty({ description: 'Template name (approved by WhatsApp)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Template language code' })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({ description: 'Template category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'Template parameters' })
  @IsOptional()
  @IsArray()
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time';
    text?: string;
  }>;

  @ApiPropertyOptional({ description: 'Header media URL' })
  @IsOptional()
  @IsUrl()
  headerMediaUrl?: string;

  @ApiPropertyOptional({ description: 'Header media type' })
  @IsOptional()
  @IsString()
  headerMediaType?: 'image' | 'video' | 'document';
}

/**
 * Campaign Response DTOs
 */
export class CampaignResponseDto {
  @ApiProperty()
  campaign_id: string;

  @ApiProperty()
  business_id: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  campaign_name: string;

  @ApiProperty({ enum: CampaignType })
  campaign_type: string;

  @ApiProperty({ enum: CampaignChannel })
  channel: string;

  @ApiProperty({ enum: CampaignStatus })
  status: string;

  @ApiPropertyOptional()
  scheduled_at?: Date;

  @ApiPropertyOptional()
  sent_at?: Date;

  @ApiPropertyOptional()
  completed_at?: Date;

  @ApiProperty()
  audience_type: string;

  @ApiPropertyOptional()
  audience_filter?: any;

  @ApiProperty()
  total_recipients: number;

  @ApiProperty()
  sent_count: number;

  @ApiProperty()
  delivered_count: number;

  @ApiProperty()
  failed_count: number;

  @ApiProperty()
  clicked_count: number;

  @ApiProperty()
  converted_count: number;

  @ApiPropertyOptional()
  whatsapp_template_name?: string;

  @ApiPropertyOptional()
  template_parameters?: any[];

  @ApiPropertyOptional()
  media_url?: string;

  @ApiPropertyOptional()
  product_id?: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class CampaignStatsDto {
  @ApiProperty()
  campaignId: string;

  @ApiProperty()
  totalRecipients: number;

  @ApiProperty()
  sentCount: number;

  @ApiProperty()
  deliveredCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  clickedCount: number;

  @ApiProperty()
  convertedCount: number;

  @ApiProperty()
  deliveryRate: number;

  @ApiProperty()
  clickRate: number;

  @ApiProperty()
  conversionRate: number;
}

export class AudiencePreviewDto {
  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  audienceType: string;

  @ApiProperty({ type: [Object] })
  sample: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
}
