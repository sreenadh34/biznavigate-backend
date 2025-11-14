import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a new customer
 * Phone is required, other fields optional
 */
export class CreateCustomerDto {
  @IsUUID()
  @IsNotEmpty()
  business_id: string;

  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid international format (E.164)',
  })
  phone: string; // E.164 format: +919876543210

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'WhatsApp number must be a valid international format (E.164)',
  })
  whatsapp_number?: string;
}
