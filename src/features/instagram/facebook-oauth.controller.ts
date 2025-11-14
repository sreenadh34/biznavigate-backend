import { Controller, Get, Query, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { InstagramService } from './instagram.service';
import { ConfigService } from '@nestjs/config';

/**
 * Controller to handle Facebook OAuth callbacks
 * This is needed because Facebook redirects to /facebook/auth/callback
 * but our main Instagram integration logic is under /instagram
 */
@ApiTags('Facebook OAuth')
@Controller('facebook')
export class FacebookOAuthController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly configService: ConfigService,
  ) {}

  @Get('auth/callback')
  @ApiExcludeEndpoint()
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (!code || !state) {
      // Redirect to frontend with error
      return res.redirect(
        `${frontendUrl}/settings/instagram/callback?error=invalid_request&error_description=Missing code or state`,
      );
    }

    try {
      const result = await this.instagramService.handleOAuthCallback(code, state);
      // Redirect to frontend callback page with success
      const params = new URLSearchParams({
        success: 'true',
        access_token: result.accessToken,
        expires_in: result.expiresIn.toString(),
        business_id: result.businessId,
      });
      return res.redirect(`${frontendUrl}/settings/instagram/callback?${params.toString()}`);
    } catch (error) {
      // Redirect to frontend with error
      const errorMessage = error.message || 'Failed to complete OAuth flow';
      return res.redirect(
        `${frontendUrl}/settings/instagram/callback?error=connection_failed&error_description=${encodeURIComponent(errorMessage)}`,
      );
    }
  }
}
