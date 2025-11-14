import { IsString, IsBoolean, IsArray, IsOptional, IsEnum } from 'class-validator';
import { NotificationChannel } from '../../domain/entities';

/**
 * DTO for creating a notification template
 */
export class CreateTemplateDto {
  @IsOptional()
  @IsString()
  business_id?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsString()
  template_key: string;

  @IsString()
  template_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Email content
  @IsOptional()
  @IsString()
  email_subject?: string;

  @IsOptional()
  @IsString()
  email_body?: string;

  @IsOptional()
  @IsString()
  email_html?: string;

  // SMS content
  @IsOptional()
  @IsString()
  sms_body?: string;

  // WhatsApp content
  @IsOptional()
  @IsString()
  whatsapp_body?: string;

  // Push notification content
  @IsOptional()
  @IsString()
  push_title?: string;

  @IsOptional()
  @IsString()
  push_body?: string;

  // Variables
  @IsArray()
  @IsString({ each: true })
  variables: string[];

  // Enabled channels
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  enabled_channels: NotificationChannel[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * DTO for updating a notification template
 */
export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  template_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  email_subject?: string;

  @IsOptional()
  @IsString()
  email_body?: string;

  @IsOptional()
  @IsString()
  email_html?: string;

  @IsOptional()
  @IsString()
  sms_body?: string;

  @IsOptional()
  @IsString()
  whatsapp_body?: string;

  @IsOptional()
  @IsString()
  push_title?: string;

  @IsOptional()
  @IsString()
  push_body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  enabled_channels?: NotificationChannel[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
