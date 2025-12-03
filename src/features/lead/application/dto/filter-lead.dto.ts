import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

/**
 * Filter Lead DTO
 * Extends PaginationDto with lead-specific filters
 */
export class FilterLeadDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by lead status',
    example: 'new',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by source',
    enum: ['instagram', 'whatsapp', 'website'],
    example: 'whatsapp',
  })
  @IsOptional()
  @IsEnum(['instagram', 'whatsapp', 'website', 'instagram_comment', 'instagram_dm', 'website_form'])
  source?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned agent ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  assigned_agent_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by lead quality',
    enum: ['hot', 'warm', 'cold'],
    example: 'hot',
  })
  @IsOptional()
  @IsEnum(['hot', 'warm', 'cold'])
  lead_quality?: string;

  @ApiPropertyOptional({
    description: 'Search in name, email, phone (full-text search)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date from (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date to (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Minimum lead score',
    minimum: 0,
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score_min?: number;

  @ApiPropertyOptional({
    description: 'Maximum lead score',
    maximum: 100,
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score_max?: number;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated tag IDs)',
    example: 'vip,urgent',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Filter by converted status',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  is_converted?: boolean;

  @ApiPropertyOptional({
    description: 'Include inactive/deleted leads',
    default: false,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  include_inactive?: boolean = false;
}
