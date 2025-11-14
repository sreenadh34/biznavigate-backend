import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InstagramApiClientService } from './infrastructure/instagram-api-client.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { KafkaConsumerService } from '../kafka/kafka-consumer.service';
import * as crypto from 'crypto';

interface PendingContext {
  commentId?: string;
  postId?: string;
  conversationId?: string;
  from: {
    id: string;
    username?: string;
  };
  businessId: string;
  tenantId: string;
  accountId: string;
  type: 'comment' | 'dm' | 'mention';
}

@Injectable()
export class InstagramService implements OnModuleInit {
  private readonly logger = new Logger(InstagramService.name);
  private readonly pendingMessages = new Map<string, PendingContext>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: InstagramApiClientService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('Instagram Service initialized');
  }

  /**
   * Generate OAuth URL for Facebook login
   */
  async getOAuthUrl(businessId: string, redirectUri?: string): Promise<string> {
    const appId = this.configService.get<string>('instagram.appId');
    const scopes = this.configService.get<string[]>('instagram.oauthScopes');
    const defaultRedirectUri = this.configService.get<string>('instagram.oauthRedirectUri');

    const url = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    url.searchParams.append('client_id', appId);
    url.searchParams.append('redirect_uri', redirectUri || defaultRedirectUri);
    url.searchParams.append('scope', scopes.join(','));
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('state', this.generateState(businessId));

    return url.toString();
  }

  /**
   * Handle OAuth callback and connect Instagram account
   */
  async handleOAuthCallback(code: string, state: string): Promise<any> {
    try {
      // Verify state and extract business ID
      const businessId = this.verifyState(state);

      // Exchange code for access token
      const redirectUri = this.configService.get<string>('instagram.oauthRedirectUri');
      const tokenData = await this.circuitBreaker.execute(() =>
        this.apiClient.exchangeCodeForToken(code, redirectUri),
      );

      // Exchange for long-lived token (60 days)
      const longLivedToken = await this.circuitBreaker.execute(() =>
        this.apiClient.getLongLivedToken(tokenData.access_token),
      );

      return {
        accessToken: longLivedToken.access_token,
        expiresIn: longLivedToken.expires_in || 5184000, // 60 days in seconds
        businessId,
      };
    } catch (error) {
      this.logger.error('OAuth callback failed:', error);
      throw new BadRequestException('Failed to complete OAuth flow');
    }
  }

  /**
   * Connect Instagram account to business
   */
  async connectInstagramAccount(
    facebookPageId: string,
    accessToken: string,
    businessId: string,
  ): Promise<any> {
    try {
      // Get Instagram account linked to Facebook page
      const pageData = await this.circuitBreaker.execute(() =>
        this.apiClient.getInstagramAccounts(facebookPageId, accessToken),
      );

      if (!pageData.instagram_business_account) {
        throw new NotFoundException('No Instagram Business Account linked to this Facebook Page');
      }

      const igAccount = pageData.instagram_business_account;

      // Get business and tenant info
      const business = await this.prisma.businesses.findUnique({
        where: { business_id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Calculate token expiry (60 days from now)
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 60);

      // Save to database
      const account = await this.prisma.social_accounts.create({
        data: {
          business_id: businessId,
          platform: 'instagram',
          platform_user_id: igAccount.id,
          username: igAccount.username || igAccount.name,
          page_id: facebookPageId,
          access_token: this.encryptToken(accessToken),
          token_expiry: tokenExpiry,
          profile_picture: igAccount.profile_picture_url,
          follower_count: igAccount.followers_count,
          following_count: igAccount.follows_count,
          media_count: igAccount.media_count,
          instagram_business_account_id: igAccount.id,
          facebook_page_id: facebookPageId,
          account_type: 'business',
          biography: igAccount.biography,
          website: igAccount.website,
          is_active: true,
          last_synced_at: new Date(),
        },
      });

      this.logger.log(`Instagram account ${igAccount.username} connected for business ${businessId}`);

      return {
        accountId: account.account_id,
        username: igAccount.username,
        followersCount: igAccount.followers_count,
      };
    } catch (error) {
      this.logger.error('Failed to connect Instagram account:', error);
      throw error;
    }
  }

  /**
   * Get all Instagram accounts for a business
   */
  async getInstagramAccounts(businessId: string): Promise<any[]> {
    const accounts = await this.prisma.social_accounts.findMany({
      where: {
        business_id: businessId,
        platform: 'instagram',
        is_active: true,
      },
      select: {
        account_id: true,
        platform_user_id: true,
        username: true,
        profile_picture: true,
        follower_count: true,
        following_count: true,
        media_count: true,
        token_expiry: true,
        last_synced_at: true,
        created_at: true,
      },
    });

    return accounts;
  }

  /**
   * Disconnect Instagram account
   */
  async disconnectAccount(accountId: string, businessId: string): Promise<void> {
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        account_id: accountId,
        business_id: businessId,
        platform: 'instagram',
      },
    });

    if (!account) {
      throw new NotFoundException('Instagram account not found');
    }

    await this.prisma.social_accounts.update({
      where: { account_id: accountId },
      data: { is_active: false },
    });

    this.logger.log(`Instagram account ${account.username} disconnected`);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(accountId: string): Promise<void> {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const currentToken = this.decryptToken(account.access_token);

      const newTokenData = await this.circuitBreaker.execute(() =>
        this.apiClient.refreshAccessToken(currentToken),
      );

      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 60);

      await this.prisma.social_accounts.update({
        where: { account_id: accountId },
        data: {
          access_token: this.encryptToken(newTokenData.access_token),
          token_expiry: tokenExpiry,
          updated_at: new Date(),
        },
      });

      this.logger.log(`Access token refreshed for account ${accountId}`);
    } catch (error) {
      this.logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Sync account info (followers, media count, etc.)
   */
  async syncAccountInfo(accountId: string): Promise<void> {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    try {
      const accessToken = this.decryptToken(account.access_token);

      const accountInfo = await this.circuitBreaker.execute(() =>
        this.apiClient.getAccountInfo(account.platform_user_id, accessToken),
      );

      await this.prisma.social_accounts.update({
        where: { account_id: accountId },
        data: {
          username: accountInfo.username,
          profile_picture: accountInfo.profile_picture_url,
          follower_count: accountInfo.followers_count,
          following_count: accountInfo.follows_count,
          media_count: accountInfo.media_count,
          biography: accountInfo.biography,
          website: accountInfo.website,
          last_synced_at: new Date(),
        },
      });

      this.logger.log(`Account info synced for ${accountInfo.username}`);
    } catch (error) {
      this.logger.error('Failed to sync account info:', error);
      throw error;
    }
  }

  /**
   * Handle incoming comment webhook
   */
  async handleCommentWebhook(webhookData: any): Promise<void> {
    try {
      const { id: commentId, from, text, media_id, post_id } = webhookData;

      // Find business by Instagram account ID
      const account = await this.prisma.social_accounts.findFirst({
        where: {
          platform: 'instagram',
          platform_user_id: from.id, // This might need adjustment based on actual webhook structure
          is_active: true,
        },
        include: {
          businesses: true,
        },
      });

      if (!account) {
        this.logger.warn(`No active Instagram account found for webhook`);
        return;
      }

      // Create lead
      const lead = await this.prisma.leads.create({
        data: {
          business_id: account.business_id,
          tenant_id: account.businesses.tenant_id,
          source: 'instagram_comment',
          source_reference_id: commentId,
          platform_user_id: from.id,
          post_id: post_id || media_id,
          page_id: account.page_id,
          status: 'new',
        },
      });

      // Store pending context
      this.pendingMessages.set(lead.lead_id, {
        commentId,
        postId: post_id || media_id,
        from: {
          id: from.id,
          username: from.username,
        },
        businessId: account.business_id,
        tenantId: account.businesses.tenant_id,
        accountId: account.account_id,
        type: 'comment',
      });

      // Register AI response handler
      this.kafkaConsumer.registerMessageHandler(lead.lead_id, {
        handleAiResponse: (aiResult) => this.handleAiResponse(lead.lead_id, aiResult),
      });

      // Send to AI for processing
      await this.kafkaProducer.requestAiProcessing({
        lead_id: lead.lead_id,
        business_id: account.business_id,
        text: text || '',
        business_type: account.businesses.business_type || 'service',
        priority: 'normal',
        context: {
          source: 'instagram_comment',
          post_id: post_id || media_id,
          platform_user_id: from.id,
        },
      });

      this.logger.log(`Instagram comment processed for lead ${lead.lead_id}`);
    } catch (error) {
      this.logger.error('Failed to handle comment webhook:', error);
    }
  }

  /**
   * Handle incoming DM webhook
   */
  async handleDirectMessageWebhook(webhookData: any): Promise<void> {
    try {
      const { sender, recipient, message } = webhookData;

      // Find business by Instagram account ID (recipient)
      const account = await this.prisma.social_accounts.findFirst({
        where: {
          platform: 'instagram',
          platform_user_id: recipient.id,
          is_active: true,
        },
        include: {
          businesses: true,
        },
      });

      if (!account) {
        this.logger.warn(`No active Instagram account found for DM webhook`);
        return;
      }

      // Create or find existing lead
      let lead = await this.prisma.leads.findFirst({
        where: {
          business_id: account.business_id,
          platform_user_id: sender.id,
          source: 'instagram_dm',
        },
      });

      if (!lead) {
        lead = await this.prisma.leads.create({
          data: {
            business_id: account.business_id,
            tenant_id: account.businesses.tenant_id,
            source: 'instagram_dm',
            platform_user_id: sender.id,
            page_id: account.page_id,
            status: 'new',
          },
        });
      }

      // Store pending context
      this.pendingMessages.set(lead.lead_id, {
        from: {
          id: sender.id,
          username: sender.username,
        },
        businessId: account.business_id,
        tenantId: account.businesses.tenant_id,
        accountId: account.account_id,
        type: 'dm',
      });

      // Register AI response handler
      this.kafkaConsumer.registerMessageHandler(lead.lead_id, {
        handleAiResponse: (aiResult) => this.handleAiResponse(lead.lead_id, aiResult),
      });

      // Send to AI for processing
      await this.kafkaProducer.requestAiProcessing({
        lead_id: lead.lead_id,
        business_id: account.business_id,
        text: message.text || '',
        business_type: account.businesses.business_type || 'service',
        priority: 'normal',
        context: {
          source: 'instagram_dm',
          platform_user_id: sender.id,
        },
      });

      this.logger.log(`Instagram DM processed for lead ${lead.lead_id}`);
    } catch (error) {
      this.logger.error('Failed to handle DM webhook:', error);
    }
  }

  /**
   * Handle AI response and send reply
   */
  private async handleAiResponse(leadId: string, aiResult: any): Promise<void> {
    const context = this.pendingMessages.get(leadId);

    if (!context) {
      this.logger.warn(`No pending context found for lead ${leadId}`);
      return;
    }

    try {
      // Get account to retrieve access token
      const account = await this.prisma.social_accounts.findUnique({
        where: { account_id: context.accountId },
      });

      if (!account) {
        this.logger.error(`Account not found: ${context.accountId}`);
        return;
      }

      const accessToken = this.decryptToken(account.access_token);

      // Use AI suggested response
      const responseMessage = aiResult.suggested_response || 'Thank you for your message!';

      // Send reply based on type
      if (context.type === 'comment' && context.commentId) {
        await this.circuitBreaker.execute(() =>
          this.apiClient.replyToComment(context.commentId, responseMessage, accessToken),
        );
        this.logger.log(`Replied to Instagram comment ${context.commentId}`);
      } else if (context.type === 'dm') {
        await this.circuitBreaker.execute(() =>
          this.apiClient.sendDirectMessage(
            account.platform_user_id,
            context.from.id,
            responseMessage,
            accessToken,
          ),
        );
        this.logger.log(`Sent Instagram DM to ${context.from.username}`);
      }

      // Log activity
      await this.prisma.lead_activities.create({
        data: {
          lead_id: leadId,
          business_id: context.businessId,
          tenant_id: context.tenantId,
          activity_type: 'ai_reply_sent',
          activity_description: `AI reply sent via Instagram ${context.type}`,
          actor_type: 'system',
          channel: 'instagram',
          message_content: responseMessage,
          metadata: {
            intent: aiResult.intent,
            confidence: aiResult.confidence,
            entities: aiResult.entities,
          },
        },
      });

      // Clean up
      this.pendingMessages.delete(leadId);
    } catch (error) {
      this.logger.error('Failed to handle AI response:', error);
    }
  }

  /**
   * Encrypt access token before storing
   */
  private encryptToken(token: string): string {
    // Use a simple encryption - in production, use proper encryption library
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.configService.get<string>('instagram.appSecret'), 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt access token
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.configService.get<string>('instagram.appSecret'), 'salt', 32);
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate state for OAuth CSRF protection
   */
  private generateState(businessId: string): string {
    const timestamp = Date.now();
    const data = `${businessId}:${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Verify state and extract business ID
   */
  private verifyState(state: string): string {
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf8');
      console.log('Decoded state:', decoded);
      const [businessId, timestamp] = decoded.split(':');

      // Verify timestamp is not older than 30 minutes (increased from 10 for OAuth flow)
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      if (now - parseInt(timestamp) > thirtyMinutes) {
        throw new Error('State expired');
      }

      return businessId;
    } catch (error) {
      console.error('State verification failed:', error);
      throw new BadRequestException('Invalid state parameter');
    }
  }
}
