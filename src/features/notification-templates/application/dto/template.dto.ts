import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  ValidateNested,
  IsObject,
  MaxLength,
  MinLength,
  Matches,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/**
 * Notification Channels
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}

/**
 * Template Variable Types
 */
export enum VariableType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
}

/**
 * Template Variable Definition
 */
export class TemplateVariableDto {
  @ApiProperty({
    description: 'Variable key (used in template as {{key}})',
    example: 'customerName',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Variable key must start with letter or underscore and contain only letters, numbers, and underscores',
  })
  key: string;

  @ApiProperty({
    description: 'Variable display name',
    example: 'Customer Name',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'Variable type',
    enum: VariableType,
    example: VariableType.TEXT,
  })
  @IsEnum(VariableType)
  type: VariableType;

  @ApiPropertyOptional({
    description: 'Variable description',
    example: 'The full name of the customer',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Default value if not provided',
    example: 'Valued Customer',
  })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Whether this variable is required',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Example value for testing',
    example: 'John Doe',
  })
  @IsOptional()
  exampleValue?: any;
}

/**
 * Create Notification Template DTO
 */
export class CreateTemplateDto {
  @ApiProperty({
    description: 'Business ID',
    example: 'business-uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: 'tenant-uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    description: 'Unique template key (used for programmatic access)',
    example: 'order_confirmation',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Template key must be lowercase letters, numbers, and underscores only',
  })
  templateKey: string;

  @ApiProperty({
    description: 'Template display name',
    example: 'Order Confirmation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  templateName: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Sent when customer places an order',
  })
  @IsString()
  @IsOptional()
  description?: string;

  // Email Channel
  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Your Order #{{orderNumber}} has been confirmed!',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  emailSubject?: string;

  @ApiPropertyOptional({
    description: 'Email body (plain text)',
    example: 'Hi {{customerName}}, thank you for your order!',
  })
  @IsString()
  @IsOptional()
  emailBody?: string;

  @ApiPropertyOptional({
    description: 'Email body (HTML)',
    example: '<h1>Thank you {{customerName}}!</h1><p>Your order is confirmed.</p>',
  })
  @IsString()
  @IsOptional()
  emailHtml?: string;

  // SMS Channel
  @ApiPropertyOptional({
    description: 'SMS message body (max 1600 characters)',
    example: 'Hi {{customerName}}! Your order #{{orderNumber}} is confirmed. Track: {{trackingUrl}}',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1600)
  smsBody?: string;

  // WhatsApp Channel
  @ApiPropertyOptional({
    description: 'WhatsApp message body',
    example: 'Hello {{customerName}}! 🎉 Your order #{{orderNumber}} has been confirmed.',
  })
  @IsString()
  @IsOptional()
  whatsappBody?: string;

  // Push Notification
  @ApiPropertyOptional({
    description: 'Push notification title',
    example: 'Order Confirmed!',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  pushTitle?: string;

  @ApiPropertyOptional({
    description: 'Push notification body',
    example: 'Your order #{{orderNumber}} is on its way!',
  })
  @IsString()
  @IsOptional()
  pushBody?: string;

  // Variables
  @ApiProperty({
    description: 'Template variables definition',
    type: [TemplateVariableDto],
    example: [
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
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables: TemplateVariableDto[];

  // Enabled Channels
  @ApiProperty({
    description: 'Channels enabled for this template',
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one channel must be enabled' })
  @IsEnum(NotificationChannel, { each: true })
  enabledChannels: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'Whether template is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is a system template (cannot be deleted)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;

  @ApiProperty({
    description: 'User ID who created the template',
    example: 'user-uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  createdBy: string;
}

/**
 * Update Template DTO
 */
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @ApiPropertyOptional({
    description: 'Template name',
  })
  templateName?: string;

  @ApiPropertyOptional({
    description: 'Description',
  })
  description?: string;
}

/**
 * Template Filter DTO
 */
export class TemplateFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by business ID',
    example: 'business-uuid',
  })
  @IsUUID()
  @IsOptional()
  businessId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: 'tenant-uuid',
  })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by template key',
    example: 'order_confirmation',
  })
  @IsString()
  @IsOptional()
  templateKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by channel',
    enum: NotificationChannel,
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by system template',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;

  @ApiPropertyOptional({
    description: 'Search query (searches name, key, description)',
    example: 'order',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

/**
 * Template Preview/Test DTO
 */
export class TemplatePreviewDto {
  @ApiProperty({
    description: 'Template ID',
    example: 'template-uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({
    description: 'Channel to preview',
    enum: NotificationChannel,
    example: NotificationChannel.WHATSAPP,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Variable values for preview',
    example: {
      customerName: 'John Doe',
      orderNumber: 'ORD-12345',
      trackingUrl: 'https://example.com/track/12345',
    },
  })
  @IsObject()
  variables: Record<string, any>;
}

/**
 * Send Test Notification DTO
 */
export class SendTestNotificationDto extends TemplatePreviewDto {
  @ApiProperty({
    description: 'Test recipient email (for email channel)',
    example: 'test@example.com',
  })
  @IsString()
  @IsOptional()
  testEmail?: string;

  @ApiProperty({
    description: 'Test recipient phone (for SMS/WhatsApp)',
    example: '+919876543210',
  })
  @IsString()
  @IsOptional()
  testPhone?: string;

  @ApiProperty({
    description: 'Test device token (for push notifications)',
    example: 'device-token-here',
  })
  @IsString()
  @IsOptional()
  testDeviceToken?: string;
}

/**
 * Clone Template DTO
 */
export class CloneTemplateDto {
  @ApiProperty({
    description: 'Source template ID to clone from',
    example: 'source-template-uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  sourceTemplateId: string;

  @ApiProperty({
    description: 'New template key',
    example: 'order_confirmation_v2',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_]+$/)
  newTemplateKey: string;

  @ApiProperty({
    description: 'New template name',
    example: 'Order Confirmation V2',
  })
  @IsString()
  @IsNotEmpty()
  newTemplateName: string;

  @ApiPropertyOptional({
    description: 'Whether to copy as active or inactive',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  copyAsActive?: boolean;
}

/**
 * Bulk Template Action DTO
 */
export class BulkTemplateActionDto {
  @ApiProperty({
    description: 'Template IDs to act on',
    example: ['template-uuid-1', 'template-uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  templateIds: string[];

  @ApiProperty({
    description: 'Action to perform',
    enum: ['activate', 'deactivate', 'delete'],
    example: 'activate',
  })
  @IsEnum(['activate', 'deactivate', 'delete'])
  action: 'activate' | 'deactivate' | 'delete';
}

/**
 * Template Validation Result
 */
export class TemplateValidationResultDto {
  @ApiProperty({
    description: 'Whether template is valid',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Validation errors',
    example: [],
  })
  errors: string[];

  @ApiProperty({
    description: 'Validation warnings',
    example: ['Variable {{discount}} is defined but not used in any channel'],
  })
  warnings: string[];

  @ApiProperty({
    description: 'Detected variables in template content',
    example: ['customerName', 'orderNumber'],
  })
  detectedVariables: string[];

  @ApiProperty({
    description: 'Missing variable definitions',
    example: [],
  })
  missingDefinitions: string[];
}
