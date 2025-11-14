import { IsString, IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * DTO for creating/updating notification preferences
 */
export class UpdatePreferenceDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  business_id?: string;

  // Channel preferences
  @IsOptional()
  @IsBoolean()
  email_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sms_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsapp_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  push_enabled?: boolean;

  // Notification type preferences
  @IsOptional()
  @IsObject()
  preferences?: {
    order_updates?: boolean;
    payment_updates?: boolean;
    promotional?: boolean;
    newsletters?: boolean;
    account_updates?: boolean;
    [key: string]: boolean | undefined;
  };

  // Quiet hours
  @IsOptional()
  @IsObject()
  quiet_hours?: {
    enabled: boolean;
    start: string;
    end: string;
  };

  // Channel preferences per notification type
  @IsOptional()
  @IsObject()
  channel_preferences?: Record<string, string[]>;
}

/**
 * DTO for querying preferences
 */
export class GetPreferenceDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  business_id?: string;
}
