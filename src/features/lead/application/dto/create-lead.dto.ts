import {
  IsEnum,
  IsOptional,
  IsString,
  IsEmail,
  IsUUID,
  MaxLength,
  Matches,
  IsObject,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({
    description: 'Source of the lead',
    enum: ['instagram', 'whatsapp', 'website'],
    example: 'whatsapp',
  })
  @IsEnum(['instagram', 'whatsapp', 'website', 'instagram_comment', 'instagram_dm', 'website_form'])
  source: string;

  @ApiProperty({
    description: 'Business ID (tenant isolation)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  business_id: string;

  @ApiPropertyOptional({
    description: 'Source reference ID (e.g., Instagram post ID)',
    maxLength: 255,
    example: 'IG_123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_reference_id?: string;

  @ApiPropertyOptional({
    description: 'Platform user ID (e.g., Instagram user ID)',
    maxLength: 255,
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  platform_user_id?: string;

  @ApiPropertyOptional({
    description: 'Post ID where lead originated',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  post_id?: string;

  @ApiPropertyOptional({
    description: 'Page/Account ID',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  page_id?: string;

  @ApiPropertyOptional({
    description: 'First name',
    maxLength: 100,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    maxLength: 100,
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Phone number (10 digits)',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'Phone must be exactly 10 digits',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Alternate phone number',
  })
  @IsOptional()
  @IsString()
  alternate_phone?: string;

  @ApiPropertyOptional({
    description: 'City',
    maxLength: 100,
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State',
    maxLength: 100,
    example: 'Maharashtra',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Country',
    maxLength: 100,
    default: 'India',
    example: 'India',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string = 'India';

  @ApiPropertyOptional({
    description: 'Pincode',
    maxLength: 10,
    example: '400001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @ApiPropertyOptional({
    description: 'Intent type detected',
    maxLength: 50,
    example: 'product_inquiry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  intent_type?: string;

  @ApiPropertyOptional({
    description: 'Lead quality rating',
    enum: ['hot', 'warm', 'cold'],
    example: 'warm',
  })
  @IsOptional()
  @IsEnum(['hot', 'warm', 'cold'])
  lead_quality?: string;

  @ApiPropertyOptional({
    description: 'Interested products (JSON array)',
    example: ['product-1', 'product-2'],
  })
  @IsOptional()
  @IsArray()
  interested_products?: any[];

  @ApiPropertyOptional({
    description: 'Interested courses (JSON array)',
    example: ['course-1'],
  })
  @IsOptional()
  @IsArray()
  interested_courses?: any[];

  @ApiPropertyOptional({
    description: 'Tags (JSON array)',
    example: ['vip', 'urgent'],
  })
  @IsOptional()
  @IsArray()
  tags?: any[];

  @ApiPropertyOptional({
    description: 'Custom fields (JSON object)',
    example: { budget: '50000', timeline: '1 month' },
  })
  @IsOptional()
  @IsObject()
  custom_fields?: any;

  @ApiPropertyOptional({
    description: 'Extracted entities from NLP (JSON)',
  })
  @IsOptional()
  @IsObject()
  extracted_entities?: any;

  @ApiPropertyOptional({
    description: 'Sentiment score (-1 to 1)',
    minimum: -1,
    maximum: 1,
    example: 0.75,
  })
  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(1)
  sentiment_score?: number;

  @ApiPropertyOptional({
    description: 'Preferred contact method',
    enum: ['phone', 'email', 'whatsapp'],
    example: 'whatsapp',
  })
  @IsOptional()
  @IsEnum(['phone', 'email', 'whatsapp'])
  preferred_contact_method?: string;

  @ApiPropertyOptional({
    description: 'Preferred contact time',
    maxLength: 50,
    example: 'Morning 9-12',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferred_contact_time?: string;

  @ApiPropertyOptional({
    description: 'Language preference',
    maxLength: 10,
    default: 'en',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language_preference?: string = 'en';

  @ApiPropertyOptional({
    description: 'UTM source',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_source?: string;

  @ApiPropertyOptional({
    description: 'UTM medium',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_medium?: string;

  @ApiPropertyOptional({
    description: 'UTM campaign',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_campaign?: string;

  @ApiPropertyOptional({
    description: 'Referral source',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referral_source?: string;
}
