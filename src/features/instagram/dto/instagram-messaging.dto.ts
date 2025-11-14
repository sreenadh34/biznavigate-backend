import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}

export class ReplyToCommentDto {
  @ApiProperty({ description: 'Comment ID to reply to' })
  @IsString()
  commentId: string;

  @ApiProperty({ description: 'Reply message text' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;
}

export class ReplyToDirectMessageDto {
  @ApiProperty({ description: 'Instagram user ID to send message to' })
  @IsString()
  recipientId: string;

  @ApiProperty({ description: 'Message text' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Message type', enum: MessageType })
  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType;

  @ApiPropertyOptional({ description: 'Media URL for image/video messages' })
  @IsString()
  @IsOptional()
  mediaUrl?: string;
}

export class GetConversationsDto {
  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Limit number of conversations' })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsString()
  @IsOptional()
  after?: string;
}

export class GetMessagesDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsString()
  conversationId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Limit number of messages' })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsString()
  @IsOptional()
  after?: string;
}

export class DeleteCommentDto {
  @ApiProperty({ description: 'Comment ID to delete' })
  @IsString()
  commentId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;
}

export class HideCommentDto {
  @ApiProperty({ description: 'Comment ID to hide/unhide' })
  @IsString()
  commentId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Hide or unhide' })
  @IsString()
  hide: string; // 'true' or 'false'
}
