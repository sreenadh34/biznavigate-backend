import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for updating customer
 * All fields optional except business_id and tenant_id are excluded
 */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  engagement_score?: number;
}
