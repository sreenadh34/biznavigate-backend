import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  Min,
  Max,
  IsEmail,
  IsPhoneNumber,
  ValidateIf,
} from 'class-validator';
import { NotificationChannel, NotificationPriority } from '../../domain/entities';

/**
 * DTO for sending a notification
 */
export class SendNotificationDto {
  @IsString()
  business_id: string;

  @IsString()
  tenant_id: string;

  // Recipient (at least one must be provided)
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @ValidateIf((o) => o.channel === NotificationChannel.EMAIL)
  @IsEmail()
  recipient_email?: string;

  @ValidateIf((o) => o.channel === NotificationChannel.SMS || o.channel === NotificationChannel.WHATSAPP)
  @IsString()
  recipient_phone?: string;

  @IsOptional()
  @IsString()
  recipient_name?: string;

  // Template or direct content
  @IsOptional()
  @IsString()
  template_key?: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  // Direct content (if not using template)
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  html_body?: string;

  // Context data for template rendering
  @IsOptional()
  @IsObject()
  context_data?: Record<string, any>;

  // Related entity
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @IsOptional()
  @IsString()
  related_entity_id?: string;

  // Priority
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  // Scheduling
  @IsOptional()
  scheduled_at?: Date;
}

/**
 * DTO for sending multi-channel notification
 */
export class SendMultiChannelNotificationDto {
  @IsString()
  business_id: string;

  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsEmail()
  recipient_email?: string;

  @IsOptional()
  @IsString()
  recipient_phone?: string;

  @IsOptional()
  @IsString()
  recipient_name?: string;

  @IsString()
  template_key: string;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @IsObject()
  context_data: Record<string, any>;

  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @IsOptional()
  @IsString()
  related_entity_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

/**
 * DTO for bulk notification sending
 */
export class SendBulkNotificationDto {
  @IsString()
  business_id: string;

  @IsString()
  tenant_id: string;

  @IsString()
  template_key: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsArray()
  recipients: BulkRecipient[];

  @IsOptional()
  @IsNumber()
  priority?: number;
}

export interface BulkRecipient {
  customer_id?: string;
  user_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_name?: string;
  context_data: Record<string, any>;
}
