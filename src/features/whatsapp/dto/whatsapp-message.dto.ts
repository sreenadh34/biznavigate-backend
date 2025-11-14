import { IsString, IsOptional, IsObject, ValidateNested, IsArray, IsEnum, IsUrl, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Send Message Types
export enum SendMessageType {
  TEXT = 'text',
  TEMPLATE = 'template',
  INTERACTIVE = 'interactive',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  LOCATION = 'location',
  REACTION = 'reaction',
}

// Interactive Message Types
export enum InteractiveSendType {
  BUTTON = 'button',
  LIST = 'list',
  PRODUCT = 'product',
  PRODUCT_LIST = 'product_list',
}

// ==================== Text Message ====================

export class TextDto {
  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  preview_url?: boolean;
}

// ==================== Template Message ====================

export class ParameterDto {
  @ApiProperty()
  @IsString()
  type: string; // 'text', 'currency', 'date_time', 'image', 'document', 'video'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  date_time?: {
    fallback_value: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  image?: {
    link?: string;
    id?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  document?: {
    link?: string;
    id?: string;
    filename?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  video?: {
    link?: string;
    id?: string;
  };
}

export class ComponentDto {
  @ApiProperty()
  @IsString()
  type: string; // 'header', 'body', 'button'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sub_type?: string; // For button: 'quick_reply', 'url'

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  index?: number; // For button

  @ApiPropertyOptional({ type: [ParameterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  @IsOptional()
  parameters?: ParameterDto[];
}

export class LanguageDto {
  @ApiProperty()
  @IsString()
  code: string; // 'en_US', 'pt_BR', etc.
}

export class TemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ type: LanguageDto })
  @ValidateNested()
  @Type(() => LanguageDto)
  language: LanguageDto;

  @ApiPropertyOptional({ type: [ComponentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  @IsOptional()
  components?: ComponentDto[];
}

// ==================== Interactive Message ====================

export class HeaderDto {
  @ApiProperty()
  @IsString()
  type: string; // 'text', 'image', 'video', 'document'

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  image?: {
    link?: string;
    id?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  video?: {
    link?: string;
    id?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  document?: {
    link?: string;
    id?: string;
    filename?: string;
  };
}

export class BodyDto {
  @ApiProperty()
  @IsString()
  text: string;
}

export class FooterDto {
  @ApiProperty()
  @IsString()
  text: string;
}

export class ButtonReplyDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;
}

export class ActionButtonDto {
  @ApiProperty()
  @IsString()
  type: string; // 'reply'

  @ApiProperty()
  @ValidateNested()
  @Type(() => ButtonReplyDto)
  reply: ButtonReplyDto;
}

export class RowDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class SectionDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ type: [RowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RowDto)
  rows: RowDto[];
}

export class ActionDto {
  @ApiPropertyOptional({ type: [ActionButtonDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionButtonDto)
  @IsOptional()
  buttons?: ActionButtonDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  button?: string; // For list

  @ApiPropertyOptional({ type: [SectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  @IsOptional()
  sections?: SectionDto[];
}

export class InteractiveDto {
  @ApiProperty()
  @IsEnum(InteractiveSendType)
  type: InteractiveSendType;

  @ApiPropertyOptional({ type: HeaderDto })
  @ValidateNested()
  @Type(() => HeaderDto)
  @IsOptional()
  header?: HeaderDto;

  @ApiProperty({ type: BodyDto })
  @ValidateNested()
  @Type(() => BodyDto)
  body: BodyDto;

  @ApiPropertyOptional({ type: FooterDto })
  @ValidateNested()
  @Type(() => FooterDto)
  @IsOptional()
  footer?: FooterDto;

  @ApiProperty({ type: ActionDto })
  @ValidateNested()
  @Type(() => ActionDto)
  action: ActionDto;
}

// ==================== Media Message ====================

export class MediaDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string; // Media ID from upload

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  link?: string; // External URL

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  filename?: string; // For documents
}

// ==================== Location Message ====================

export class LocationDto {
  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;
}

// ==================== Reaction Message ====================

export class ReactionDto {
  @ApiProperty()
  @IsString()
  message_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emoji?: string; // Empty string to remove reaction
}

// ==================== Context (Reply) ====================

export class ContextDto {
  @ApiProperty()
  @IsString()
  message_id: string;
}

// ==================== Send Message DTO ====================

export class SendWhatsAppMessageDto {
  @ApiProperty()
  @IsString()
  messaging_product: string = 'whatsapp';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recipient_type?: string = 'individual';

  @ApiProperty()
  @IsString()
  to: string; // Phone number with country code (e.g., "1234567890")

  @ApiProperty()
  @IsEnum(SendMessageType)
  type: SendMessageType;

  @ApiPropertyOptional({ type: ContextDto })
  @ValidateNested()
  @Type(() => ContextDto)
  @IsOptional()
  context?: ContextDto;

  @ApiPropertyOptional({ type: TextDto })
  @ValidateNested()
  @Type(() => TextDto)
  @IsOptional()
  text?: TextDto;

  @ApiPropertyOptional({ type: TemplateDto })
  @ValidateNested()
  @Type(() => TemplateDto)
  @IsOptional()
  template?: TemplateDto;

  @ApiPropertyOptional({ type: InteractiveDto })
  @ValidateNested()
  @Type(() => InteractiveDto)
  @IsOptional()
  interactive?: InteractiveDto;

  @ApiPropertyOptional({ type: MediaDto })
  @ValidateNested()
  @Type(() => MediaDto)
  @IsOptional()
  image?: MediaDto;

  @ApiPropertyOptional({ type: MediaDto })
  @ValidateNested()
  @Type(() => MediaDto)
  @IsOptional()
  video?: MediaDto;

  @ApiPropertyOptional({ type: MediaDto })
  @ValidateNested()
  @Type(() => MediaDto)
  @IsOptional()
  audio?: MediaDto;

  @ApiPropertyOptional({ type: MediaDto })
  @ValidateNested()
  @Type(() => MediaDto)
  @IsOptional()
  document?: MediaDto;

  @ApiPropertyOptional({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @ApiPropertyOptional({ type: ReactionDto })
  @ValidateNested()
  @Type(() => ReactionDto)
  @IsOptional()
  reaction?: ReactionDto;
}

// ==================== Mark as Read DTO ====================

export class MarkAsReadDto {
  @ApiProperty()
  @IsString()
  messaging_product: string = 'whatsapp';

  @ApiProperty()
  @IsString()
  status: string = 'read';

  @ApiProperty()
  @IsString()
  message_id: string;
}
