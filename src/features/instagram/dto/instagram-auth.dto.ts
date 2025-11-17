import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExchangeCodeDto {
  @ApiProperty({ description: 'Authorization code from Facebook OAuth' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'State parameter for CSRF protection' })
  @IsString()
  @IsOptional()
  state?: string;
}

export class ConnectInstagramAccountDto {
  @ApiProperty({ description: 'Facebook page ID' })
  @IsString()
  facebookPageId: string;

  @ApiProperty({ description: 'Instagram business account ID' })
  @IsString()
  instagramBusinessAccountId: string;

  @ApiProperty({ description: 'Access token for the account' })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Permissions granted' })
  @IsArray()
  @IsOptional()
  permissions?: string[];

  @ApiProperty({ description: 'Business ID to link the account to' })
  @IsString()
  businessId: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Account ID to refresh token for' })
  @IsString()
  accountId: string;
}

export class DisconnectAccountDto {
  @ApiProperty({ description: 'Business ID that owns the account' })
  @IsString()
  businessId: string;

  @ApiPropertyOptional({ description: 'Reason for disconnecting' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class GetOAuthUrlDto {
  @ApiProperty({ description: 'Business ID for the OAuth flow' })
  @IsString()
  businessId: string;

  @ApiPropertyOptional({ description: 'Custom redirect URI' })
  @IsString()
  @IsOptional()
  redirectUri?: string;
}
