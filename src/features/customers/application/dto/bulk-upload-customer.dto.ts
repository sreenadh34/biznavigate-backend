import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

/**
 * DTO for bulk customer upload
 * Useful for importing from Excel/CSV
 */
export class BulkUploadCustomerDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateCustomerDto)
  customers: CreateCustomerDto[];
}

/**
 * Response DTO for bulk upload
 */
export class BulkUploadResponseDto {
  success: number;
  failed: number;
  errors: Array<{
    index: number;
    phone?: string;
    error: string;
  }>;
}
