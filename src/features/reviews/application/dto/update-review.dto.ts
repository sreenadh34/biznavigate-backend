import { IsOptional, IsInt, Min, Max, IsString, IsBoolean, IsArray, IsUrl } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photo_urls?: string[];

  @IsOptional()
  @IsUrl()
  video_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;
}
