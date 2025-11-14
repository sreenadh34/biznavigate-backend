import {
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

/**
 * DTO for bulk product upload
 * Accepts an array of products to create in a single request
 */
export class BulkUploadProductDto {
  @IsUUID()
  @IsNotEmpty()
  business_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products: CreateProductDto[];
}

/**
 * Response DTO for bulk upload
 */
export class BulkUploadResponseDto {
  success: boolean;
  totalProducts: number;
  successCount: number;
  failureCount: number;
  errors?: Array<{
    index: number;
    productName: string;
    error: string;
  }>;
  createdProducts: Array<{
    product_id: string;
    name: string;
    sku?: string;
  }>;
}
