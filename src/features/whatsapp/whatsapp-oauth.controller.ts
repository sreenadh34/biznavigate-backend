import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { WhatsAppOAuthService } from './services/whatsapp-oauth.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards';

@ApiTags('WhatsApp OAuth')
@Controller('whatsapp/oauth')
export class WhatsAppOAuthController {
  private readonly logger = new Logger(WhatsAppOAuthController.name);

  constructor(
    private readonly oauthService: WhatsAppOAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Step 1: Generate OAuth URL
   * Frontend calls this to get the Facebook OAuth URL
   */
  @Get('url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WhatsApp OAuth URL' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated successfully' })
  async getOAuthUrl(
    @Query('businessId') businessId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }

    this.logger.log(`Generating OAuth URL for business: ${businessId}`);

    const url = await this.oauthService.generateOAuthUrl(
      businessId,
      redirectUri,
    );

    return {
      success: true,
      data: { url },
    };
  }

  /**
   * Step 2: Handle OAuth Callback
   * Facebook redirects here after user authorizes
   */
  @Get('callback')
  @ApiOperation({ summary: 'Handle WhatsApp OAuth callback from Facebook' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with result' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Handle OAuth errors from Facebook
    if (error) {
      this.logger.error(`OAuth error: ${error} - ${errorDescription}`);
      return res.redirect(
        `${frontendUrl}/settings/whatsapp?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'Authorization failed')}`,
      );
    }

    // Validate required parameters
    if (!code || !state) {
      this.logger.error('Missing code or state in OAuth callback');
      return res.redirect(
        `${frontendUrl}/settings/whatsapp?error=invalid_request&message=Missing authorization code`,
      );
    }

    try {
      this.logger.log('Processing OAuth callback...');

      // Exchange code for access token and connect account
      const result = await this.oauthService.handleCallback(code, state);

      this.logger.log(
        `WhatsApp account connected successfully: ${result.phoneNumber}`,
      );

      // Redirect to success page with account info
      return res.redirect(
        `${frontendUrl}/settings/whatsapp?success=true&accountId=${result.accountId}&phoneNumber=${encodeURIComponent(result.phoneNumber)}`,
      );
    } catch (error) {
      this.logger.error('OAuth callback failed:', error);

      const errorMessage = error?.message || 'Failed to connect WhatsApp account';

      return res.redirect(
        `${frontendUrl}/settings/whatsapp?error=connection_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }
}
