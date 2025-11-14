import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectWhatsAppAccountDto {
  @ApiProperty({ description: 'Business ID' })
  @IsString()
  businessId: string;

  @ApiProperty({ description: 'WhatsApp Business Account ID' })
  @IsString()
  whatsappBusinessAccountId: string;

  @ApiProperty({ description: 'Phone Number ID from WhatsApp Business API' })
  @IsString()
  phoneNumberId: string;

  @ApiProperty({ description: 'Access Token from Facebook/Meta' })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Display phone number' })
  @IsString()
  @IsOptional()
  displayPhoneNumber?: string;
}

export class DisconnectWhatsAppAccountDto {
  @ApiProperty({ description: 'Business ID that owns the account' })
  @IsString()
  businessId: string;

  @ApiPropertyOptional({ description: 'Reason for disconnecting' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class GetAccountsDto {
  @ApiProperty({ description: 'Business ID' })
  @IsString()
  businessId: string;
}
