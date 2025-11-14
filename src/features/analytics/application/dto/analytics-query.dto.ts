import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString, IsIn } from 'class-validator';

/**
 * Query DTO for analytics endpoints
 * Supports filtering by business, tenant, and time range
 */
export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Business ID to filter analytics',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  businessId: string;

  @ApiPropertyOptional({
    description: 'Tenant ID (optional - for multi-tenant support)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Start date for time-based analytics (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for time-based analytics (ISO 8601)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Time period preset (overrides startDate/endDate)',
    enum: ['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'thisYear'],
    example: 'last30days',
  })
  @IsOptional()
  @IsIn(['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'thisYear'])
  period?: string;
}

/**
 * Query DTO for top products analytics
 */
export class TopProductsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of top products to return',
    example: 10,
    default: 10,
  })
  @IsOptional()
  limit?: number;
}
