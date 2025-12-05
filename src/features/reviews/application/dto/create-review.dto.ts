import { IsNotEmpty, IsInt, Min, Max, IsString, IsOptional, IsUUID, IsArray, IsUrl } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsNotEmpty()
  @IsUUID()
  tenant_id: string;

  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsNotEmpty()
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

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
}
