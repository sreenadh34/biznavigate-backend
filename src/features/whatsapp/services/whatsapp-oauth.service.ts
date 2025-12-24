import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as crypto from 'crypto';

interface StateData {
  businessId: string;
  timestamp: number;
  nonce: string;
}

interface WhatsAppBusinessAccount {
  id: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
}

@Injectable()
export class WhatsAppOAuthService {
  private readonly logger = new Logger(WhatsAppOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate OAuth URL for user authorization
   */
  async generateOAuthUrl(
    businessId: string,
    customRedirectUri?: string,
  ): Promise<string> {
    const appId = this.configService.get<string>('whatsapp.appId');
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion');
    const backendUrl = this.configService.get<string>('BACKEND_URL');

    const redirectUri =
      customRedirectUri || `${backendUrl}/whatsapp/oauth/callback`;

    // Generate secure state parameter
    const state = this.generateState(businessId);

    // Required permissions for WhatsApp Business
    const scopes = [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management',
    ];

    // Build OAuth URL
    const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
    url.searchParams.append('client_id', appId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('scope', scopes.join(','));
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('state', state);

    this.logger.log(`Generated OAuth URL for business: ${businessId}`);

    return url.toString();
  }

  /**
   * Handle OAuth callback and connect account
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    accountId: string;
    phoneNumber: string;
    verifiedName: string;
  }> {
    // Verify and decode state
    const { businessId } = this.verifyState(state);

    // Verify business exists
    const business = await this.prisma.businesses.findUnique({
      where: { business_id: businessId },
    });

    if (!business) {
      throw new BadRequestException('Business not found');
    }

    // Exchange code for access token
    const tokenData = await this.exchangeCodeForToken(code);

    // Get WhatsApp Business Account details
    const wabas = await this.getWhatsAppBusinessAccounts(
      tokenData.access_token,
    );

    if (!wabas || wabas.length === 0) {
      throw new BadRequestException(
        'No WhatsApp Business Accounts found. Please set up a WhatsApp Business Account in your Facebook Business Manager first.',
      );
    }

    // Use the first WABA (in production, you might want to let user select)
    const waba = wabas[0];
    const phoneNumbers = await this.getPhoneNumbers(
      waba.id,
      tokenData.access_token,
    );

    if (!phoneNumbers || phoneNumbers.length === 0) {
      throw new BadRequestException(
        'No phone numbers found for this WhatsApp Business Account. Please add a phone number in your WhatsApp Business Manager.',
      );
    }

    // Use the first phone number
    const phoneNumber = phoneNumbers[0];

    // Calculate token expiry (60 days for long-lived token)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 60);

    // Check if account already exists
    const existingAccount = await this.prisma.social_accounts.findFirst({
      where: {
        business_id: businessId,
        platform: 'whatsapp',
        platform_user_id: phoneNumber.id,
      },
    });

    let account;

    if (existingAccount) {
      // Update existing account
      account = await this.prisma.social_accounts.update({
        where: { account_id: existingAccount.account_id },
        data: {
          access_token: this.encryptToken(tokenData.access_token),
          token_expiry: tokenExpiry,
          is_active: true,
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Updated existing WhatsApp account ${phoneNumber.display_phone_number} for business ${businessId}`,
      );
    } else {
      // Create new account
      account = await this.prisma.social_accounts.create({
        data: {
          business_id: businessId,
          platform: 'whatsapp',
          platform_user_id: phoneNumber.id,
          username: phoneNumber.display_phone_number,
          page_id: phoneNumber.id, // phone_number_id
          access_token: this.encryptToken(tokenData.access_token),
          token_expiry: tokenExpiry,
          instagram_business_account_id: waba.id, // Store WABA ID here
          is_active: true,
        },
      });

      this.logger.log(
        `Created new WhatsApp account ${phoneNumber.display_phone_number} for business ${businessId}`,
      );
    }

    return {
      accountId: account.account_id,
      phoneNumber: phoneNumber.display_phone_number,
      verifiedName:
        phoneNumber.verified_name || phoneNumber.display_phone_number,
    };
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in?: number;
  }> {
    const appId = this.configService.get<string>('whatsapp.appId');
    const appSecret = this.configService.get<string>('whatsapp.appSecret');
    const backendUrl = this.configService.get<string>('BACKEND_URL');
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion');
    const redirectUri = `${backendUrl}/whatsapp/oauth/callback`;

    const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    url.searchParams.append('client_id', appId);
    url.searchParams.append('client_secret', appSecret);
    url.searchParams.append('code', code);
    url.searchParams.append('redirect_uri', redirectUri);

    this.logger.log('Exchanging code for access token...');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      this.logger.error('Failed to exchange code:', data.error);
      throw new BadRequestException(
        `Failed to exchange code: ${data.error.message || data.error.error_user_msg || 'Unknown error'}`,
      );
    }

    this.logger.log('Successfully exchanged code for access token');

    return data;
  }

  /**
   * Get WhatsApp Business Accounts for the user
   */
  private async getWhatsAppBusinessAccounts(
    accessToken: string,
  ): Promise<WhatsAppBusinessAccount[]> {
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion');
    const url = `https://graph.facebook.com/${apiVersion}/me/businesses?fields=name,id,owned_whatsapp_business_accounts{id,name}&access_token=${accessToken}`;

    this.logger.log('Fetching WhatsApp Business Accounts...');

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      this.logger.error('Failed to fetch WA Business Accounts:', data.error);
      throw new BadRequestException(
        `Failed to fetch WhatsApp Business Accounts: ${data.error.message}`,
      );
    }

    // Extract WhatsApp Business Accounts from all businesses
    const wabas: WhatsAppBusinessAccount[] = [];
    for (const business of data.data || []) {
      if (business.owned_whatsapp_business_accounts?.data) {
        wabas.push(...business.owned_whatsapp_business_accounts.data);
      }
    }

    this.logger.log(`Found ${wabas.length} WhatsApp Business Account(s)`);

    return wabas;
  }

  /**
   * Get phone numbers for a WhatsApp Business Account
   */
  private async getPhoneNumbers(
    wabaId: string,
    accessToken: string,
  ): Promise<PhoneNumber[]> {
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion');
    const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?access_token=${accessToken}`;

    this.logger.log(`Fetching phone numbers for WABA: ${wabaId}...`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      this.logger.error('Failed to fetch phone numbers:', data.error);
      throw new BadRequestException(
        `Failed to fetch phone numbers: ${data.error.message}`,
      );
    }

    const phoneNumbers = data.data || [];
    this.logger.log(`Found ${phoneNumbers.length} phone number(s)`);

    return phoneNumbers;
  }

  /**
   * Generate secure state parameter
   */
  private generateState(businessId: string): string {
    const stateData: StateData = {
      businessId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const json = JSON.stringify(stateData);
    return Buffer.from(json).toString('base64url');
  }

  /**
   * Verify and decode state parameter
   */
  private verifyState(state: string): StateData {
    try {
      const json = Buffer.from(state, 'base64url').toString('utf8');
      const stateData: StateData = JSON.parse(json);

      // Verify timestamp (30 minutes expiry)
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      if (now - stateData.timestamp > thirtyMinutes) {
        throw new Error('State expired (>30 minutes old)');
      }

      return stateData;
    } catch (error) {
      this.logger.error('State verification failed:', error);
      throw new BadRequestException(
        'Invalid or expired state parameter. Please try connecting again.',
      );
    }
  }

  /**
   * Encrypt access token for storage
   */
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = this.configService.get<string>('encryption.key');

    if (!encryptionKey) {
      throw new Error(
        'ENCRYPTION_KEY not configured. Please set ENCRYPTION_KEY in your .env file.',
      );
    }

    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }
}
