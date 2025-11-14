import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION',
}

export enum TemplateStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  DISABLED = 'DISABLED',
}

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiProperty()
  @IsString()
  language: string; // 'en_US', 'pt_BR', etc.

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  header?: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  footer?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  buttons?: string[];
}

export class GetTemplatesDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiPropertyOptional()
  @IsEnum(TemplateStatus)
  @IsOptional()
  status?: TemplateStatus;
}
