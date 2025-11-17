import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  IsUrl,
  Min,
} from 'class-validator';

/**
 * DTO for creating a new category
 */
export class CreateCategoryDto {
  @IsUUID()
  business_id: string;

  @IsUUID()
  tenant_id: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parent_category_id?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  icon_url?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  image_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  display_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  meta_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsUUID()
  created_by?: string;
}
