import { IsString, IsOptional, IsObject, ValidateNested, IsArray, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Message Types
export enum WhatsAppMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  LOCATION = 'location',
  CONTACTS = 'contacts',
  INTERACTIVE = 'interactive',
  BUTTON = 'button',
  REACTION = 'reaction',
  STICKER = 'sticker',
}

// Interactive Message Types
export enum InteractiveType {
  BUTTON_REPLY = 'button_reply',
  LIST_REPLY = 'list_reply',
}

// Status Types
export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

// Message Context (Reply to message)
export class MessageContextDto {
  @ApiProperty()
  @IsString()
  from: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;
}

// Text Message
export class TextMessageDto {
  @ApiProperty()
  @IsString()
  body: string;
}

// Image/Video/Audio/Document
export class MediaMessageDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mime_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sha256?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  filename?: string;
}

// Location Message
export class LocationMessageDto {
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

// Interactive Message Reply
export class ButtonReplyDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;
}

export class ListReplyDto {
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

export class InteractiveMessageDto {
  @ApiProperty()
  @IsEnum(InteractiveType)
  type: InteractiveType;

  @ApiPropertyOptional({ type: ButtonReplyDto })
  @ValidateNested()
  @Type(() => ButtonReplyDto)
  @IsOptional()
  button_reply?: ButtonReplyDto;

  @ApiPropertyOptional({ type: ListReplyDto })
  @ValidateNested()
  @Type(() => ListReplyDto)
  @IsOptional()
  list_reply?: ListReplyDto;
}

// Reaction Message
export class ReactionMessageDto {
  @ApiProperty()
  @IsString()
  message_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emoji?: string;
}

// Profile
export class ProfileDto {
  @ApiProperty()
  @IsString()
  name: string;
}

// Contact
export class ContactDto {
  @ApiPropertyOptional({ type: ProfileDto })
  @ValidateNested()
  @Type(() => ProfileDto)
  @IsOptional()
  profile?: ProfileDto;

  @ApiProperty()
  @IsString()
  wa_id: string;
}

// Message
export class WhatsAppMessageDto {
  @ApiProperty()
  @IsString()
  from: string;

  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsNumber()
  timestamp: number;

  @ApiProperty()
  @IsEnum(WhatsAppMessageType)
  type: WhatsAppMessageType;

  @ApiPropertyOptional({ type: MessageContextDto })
  @ValidateNested()
  @Type(() => MessageContextDto)
  @IsOptional()
  context?: MessageContextDto;

  @ApiPropertyOptional({ type: TextMessageDto })
  @ValidateNested()
  @Type(() => TextMessageDto)
  @IsOptional()
  text?: TextMessageDto;

  @ApiPropertyOptional({ type: MediaMessageDto })
  @ValidateNested()
  @Type(() => MediaMessageDto)
  @IsOptional()
  image?: MediaMessageDto;

  @ApiPropertyOptional({ type: MediaMessageDto })
  @ValidateNested()
  @Type(() => MediaMessageDto)
  @IsOptional()
  video?: MediaMessageDto;

  @ApiPropertyOptional({ type: MediaMessageDto })
  @ValidateNested()
  @Type(() => MediaMessageDto)
  @IsOptional()
  audio?: MediaMessageDto;

  @ApiPropertyOptional({ type: MediaMessageDto })
  @ValidateNested()
  @Type(() => MediaMessageDto)
  @IsOptional()
  document?: MediaMessageDto;

  @ApiPropertyOptional({ type: LocationMessageDto })
  @ValidateNested()
  @Type(() => LocationMessageDto)
  @IsOptional()
  location?: LocationMessageDto;

  @ApiPropertyOptional({ type: InteractiveMessageDto })
  @ValidateNested()
  @Type(() => InteractiveMessageDto)
  @IsOptional()
  interactive?: InteractiveMessageDto;

  @ApiPropertyOptional({ type: ReactionMessageDto })
  @ValidateNested()
  @Type(() => ReactionMessageDto)
  @IsOptional()
  reaction?: ReactionMessageDto;
}

// Status
export class StatusDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsEnum(MessageStatus)
  status: MessageStatus;

  @ApiProperty()
  @IsNumber()
  timestamp: number;

  @ApiProperty()
  @IsString()
  recipient_id: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  errors?: any[];
}

// Metadata
export class MetadataDto {
  @ApiProperty()
  @IsString()
  display_phone_number: string;

  @ApiProperty()
  @IsString()
  phone_number_id: string;
}

// Value (contains messages or statuses)
export class ValueDto {
  @ApiProperty()
  @IsString()
  messaging_product: string;

  @ApiProperty({ type: MetadataDto })
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @ApiPropertyOptional({ type: [ContactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  @IsOptional()
  contacts?: ContactDto[];

  @ApiPropertyOptional({ type: [WhatsAppMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessageDto)
  @IsOptional()
  messages?: WhatsAppMessageDto[];

  @ApiPropertyOptional({ type: [StatusDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusDto)
  @IsOptional()
  statuses?: StatusDto[];
}

// Change
export class ChangeDto {
  @ApiProperty({ type: ValueDto })
  @ValidateNested()
  @Type(() => ValueDto)
  value: ValueDto;

  @ApiProperty()
  @IsString()
  field: string;
}

// Entry
export class EntryDto {
  @ApiProperty()
  @IsString()
  id: string; // WhatsApp Business Account ID

  @ApiProperty({ type: [ChangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes: ChangeDto[];
}

// Webhook Event
export class WhatsAppWebhookDto {
  @ApiProperty()
  @IsString()
  object: string; // Always 'whatsapp_business_account'

  @ApiProperty({ type: [EntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entry: EntryDto[];
}

// Webhook Verification
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
