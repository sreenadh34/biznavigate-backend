import { IsString, IsOptional, IsObject, ValidateNested, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookChangeValueDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  from?: { id: string; username?: string };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  media_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  media_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parent_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  post_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment_id?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  sender?: {
    id: string;
    username?: string;
    name?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  recipient?: {
    id: string;
  };
}

export class WebhookChangeDto {
  @ApiProperty()
  @IsString()
  field: string; // 'comments', 'messages', 'mentions'

  @ApiProperty({ type: WebhookChangeValueDto })
  @ValidateNested()
  @Type(() => WebhookChangeValueDto)
  value: WebhookChangeValueDto;
}

export class MessagingItemDto {
  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  sender?: { id: string };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  recipient?: { id: string };

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  timestamp?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  message?: {
    mid?: string;
    text?: string;
    attachments?: any[];
  };
}

export class WebhookEntryDto {
  @ApiProperty()
  @IsString()
  id: string; // Instagram Business Account ID or Page ID

  @ApiProperty()
  @IsNumber()
  time: number; // Unix timestamp

  @ApiPropertyOptional({ type: [WebhookChangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookChangeDto)
  @IsOptional()
  changes?: WebhookChangeDto[];

  @ApiPropertyOptional({ type: [MessagingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessagingItemDto)
  @IsOptional()
  messaging?: MessagingItemDto[];
}

export class InstagramWebhookDto {
  @ApiProperty()
  @IsString()
  object: string; // 'instagram' or 'page'

  @ApiProperty({ type: [WebhookEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookEntryDto)
  entry: WebhookEntryDto[];
}

export class WebhookVerificationDto {
  @ApiProperty()
  @IsString()
  'hub.mode': string;

  @ApiProperty()
  @IsString()
  'hub.verify_token': string;

  @ApiProperty()
  @IsString()
  'hub.challenge': string;
}
