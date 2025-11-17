import { IsString, IsOptional, IsObject, IsUUID, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendWidgetMessageDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitorId?: string; // Anonymous visitor ID (generated client-side)

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitorName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitorEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitorPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  pageUrl?: string; // URL where widget is embedded

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pageTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class InitWidgetDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  pageUrl?: string;
}

export class WidgetConfigDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  botName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  position?: 'bottom-right' | 'bottom-left';
}

export class UpdateVisitorInfoDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiProperty()
  @IsString()
  visitorId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
