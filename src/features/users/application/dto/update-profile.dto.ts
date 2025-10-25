import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, IsEnum, IsObject, Matches } from 'class-validator';

export enum BusinessType {
  RETAIL = 'retail',
  ECOMMERCE = 'ecommerce',
  EDUCATION = 'education',
  HEALTHCARE = 'healthcare',
  REAL_ESTATE = 'real_estate',
  HOSPITALITY = 'hospitality',
  CONSULTING = 'consulting',
  TECHNOLOGY = 'technology',
  MANUFACTURING = 'manufacturing',
  OTHER = 'other',
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'WhatsApp business number',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'WhatsApp number must be a valid phone number with country code',
  })
  whatsapp_number?: string;

  @ApiProperty({
    description: 'Type of business',
    enum: BusinessType,
    example: BusinessType.RETAIL,
    required: false,
  })
  @IsOptional()
  @IsEnum(BusinessType)
  business_type?: BusinessType;

  @ApiProperty({
    description: 'Business logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiProperty({
    description: 'Working hours in JSON format',
    example: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '10:00', close: '14:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  working_hours?: Record<string, { open: string; close: string; closed: boolean }>;

  @ApiProperty({
    description: 'Profile completion status',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  profile_completed?: boolean;
}
