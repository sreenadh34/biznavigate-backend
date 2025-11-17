import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadImageDto {
  @ApiProperty({ description: 'Business ID' })
  @IsUUID()
  @IsString()
  business_id: string;

  @ApiProperty({ description: 'Product ID to attach image to' })
  @IsUUID()
  @IsString()
  product_id: string;

  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsString()
  @IsOptional()
  alt_text?: string;

  @ApiPropertyOptional({ description: 'Display order (lower = first)', default: 0 })
  @IsNumber()
  @IsOptional()
  display_order?: number;

  @ApiPropertyOptional({ description: 'Set as primary product image', default: false })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class UpdateImageDto {
  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsString()
  @IsOptional()
  alt_text?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsNumber()
  @IsOptional()
  display_order?: number;

  @ApiPropertyOptional({ description: 'Set as primary image' })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class ImageResponseDto {
  image_id: string;
  product_id: string;
  file_name: string;
  file_path: string;
  file_url: string; // Full URL to access the image
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
  storage_type: string;
  created_at: Date;
  updated_at: Date;
}
