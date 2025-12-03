import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { InstagramService } from "./instagram.service";
import { WebhookValidatorService } from "./infrastructure/webhook-validator.service";
// import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import {
  ExchangeCodeDto,
  GetOAuthUrlDto,
  RefreshTokenDto,
  DisconnectAccountDto,
} from "./dto/instagram-auth.dto";
import {
  ReplyToCommentDto,
  ReplyToDirectMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  DeleteCommentDto,
  HideCommentDto,
} from "./dto/instagram-messaging.dto";
import {
  GetAccountInsightsDto,
  GetMediaInsightsDto,
  GetMediaListDto,
  GetMediaDetailsDto,
  GetMediaCommentsDto,
} from "./dto/instagram-insights.dto";
import { InstagramWebhookDto } from "./dto/webhook-event.dto";
import { InstagramApiClientService } from "./infrastructure/instagram-api-client.service";
import { CircuitBreakerService } from "./infrastructure/circuit-breaker.service";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";
import { JwtAuthGuard } from "src/common/guards";
import { Response } from "express";

@ApiTags("Instagram")
@Controller("instagram")
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly webhookValidator: WebhookValidatorService,
    private readonly apiClient: InstagramApiClientService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly prisma: PrismaService
  ) {}

  // ==================== OAuth & Account Management ====================

  @Get("auth/url")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get OAuth URL for Facebook/Instagram login" })
  @ApiResponse({ status: 200, description: "OAuth URL generated" })
  async getOAuthUrl(@Query() query: GetOAuthUrlDto) {
    const url = await this.instagramService.getOAuthUrl(
      query.businessId,
      query.redirectUri
    );
    return { success: true, data: { url } };
  }

  @Get("auth/callback")
  @ApiOperation({ summary: "Handle OAuth callback from Facebook" })
  @ApiResponse({ status: 200, description: "OAuth callback processed" })
  async handleOAuthCallback(
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    if (!code || !state) {
      throw new BadRequestException("Missing code or state parameter");
    }
    const result = await this.instagramService.handleOAuthCallback(code, state);
    return { success: true, data: result };
  }

  @Post("accounts/connect")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Connect Instagram account to business" })
  @ApiResponse({ status: 201, description: "Account connected successfully" })
  async connectAccount(
    @Body()
    body: {
      facebookPageId: string;
      accessToken: string;
      businessId: string;
    }
  ) {
    const result = await this.instagramService.connectInstagramAccount(
      body.facebookPageId,
      body.accessToken,
      body.businessId
    );
    return {
      success: true,
      data: result,
      message: "Instagram account connected successfully",
    };
  }

  @Get("accounts")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all Instagram accounts for a business" })
  @ApiResponse({ status: 200, description: "Accounts retrieved" })
  async getAccounts(@Query("businessId") businessId: string) {
    const accounts =
      await this.instagramService.getInstagramAccounts(businessId);
    return { success: true, data: accounts };
  }

  @Delete("accounts/:accountId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Disconnect Instagram account" })
  @ApiResponse({ status: 200, description: "Account disconnected" })
  async disconnectAccount(
    @Param("accountId") accountId: string,
    @Body() dto: DisconnectAccountDto
  ) {
    await this.instagramService.disconnectAccount(accountId, dto.businessId);
    return { success: true, message: "Account disconnected successfully" };
  }

  @Post("accounts/:accountId/refresh")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Refresh access token for an account" })
  @ApiResponse({ status: 200, description: "Token refreshed" })
  async refreshToken(@Param("accountId") accountId: string) {
    await this.instagramService.refreshAccessToken(accountId);
    return { success: true, message: "Access token refreshed successfully" };
  }

  @Post("accounts/:accountId/sync")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Sync account info (followers, media count, etc.)" })
  @ApiResponse({ status: 200, description: "Account synced" })
  async syncAccount(@Param("accountId") accountId: string) {
    await this.instagramService.syncAccountInfo(accountId);
    return { success: true, message: "Account info synced successfully" };
  }

  // ==================== Webhook Handling ====================

  @Get("webhook")
  @ApiOperation({ summary: "Verify Instagram webhook (Facebook Graph API)" })
  @ApiResponse({ status: 200, description: "Webhook verified" })
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const verifiedChallenge = this.webhookValidator.verifyChallenge(
      mode,
      token,
      challenge
    );

    if (!verifiedChallenge) {
      throw new BadRequestException("Webhook verification failed");
    }

    res.status(HttpStatus.OK).send(verifiedChallenge);
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Instagram webhook events" })
  @ApiResponse({ status: 200, description: "Webhook received" })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: InstagramWebhookDto,
    @Headers("x-hub-signature-256") signature: string
  ) {
    // Verify webhook signature
    const rawBody = req.rawBody
      ? req.rawBody.toString("utf8")
      : JSON.stringify(body);

    console.log('Has rawBody:', !!req.rawBody);
    console.log('Signature header:', signature);
    console.log('Raw body preview:', rawBody?.substring(0, 200));

    // For development: Check if this is a Facebook test webhook
    const isTestWebhook = body.entry?.[0]?.id === '0' || rawBody?.includes('"id":"0"');

    if (!isTestWebhook) {
      const isValid = this.webhookValidator.verifySignature(rawBody, signature);

      if (!isValid) {
        throw new BadRequestException("Invalid webhook signature");
      }
    } else {
      console.log('⚠️  Test webhook detected - skipping signature verification');
    }

    // Validate webhook structure
    if (!this.webhookValidator.validateWebhookEvent(body)) {
      throw new BadRequestException("Invalid webhook event structure");
    }

    console.log("body", body)

    // Process webhook asynchronously
    setImmediate(() => this.processWebhook(body));

    // Respond immediately to Instagram
    return { success: true };
  }

  @Get("webhook/examples")
  @ApiOperation({
    summary: "Get example webhook payloads for testing",
    description: "Returns mock webhook payloads for different event types (comments, messages, mentions)"
  })
  @ApiResponse({ status: 200, description: "Example payloads returned" })
  getWebhookExamples(@Query("type") type?: string) {
    const examples = {
      comment: {
        object: "instagram",
        entry: [
          {
            id: "test-page-id-123",
            time: Date.now(),
            changes: [
              {
                field: "comments",
                value: {
                  from: {
                    id: "user-123",
                    username: "test_user"
                  },
                  media: {
                    id: "media-456",
                    media_product_type: "FEED"
                  },
                  id: "comment-789",
                  text: "This is a test comment!",
                  timestamp: new Date().toISOString()
                }
              }
            ]
          }
        ]
      },
      message: {
        object: "instagram",
        entry: [
          {
            id: "test-page-id-123",
            time: Date.now(),
            messaging: [
              {
                sender: {
                  id: "user-123"
                },
                recipient: {
                  id: "page-456"
                },
                timestamp: Date.now(),
                message: {
                  mid: "message-id-789",
                  text: "Hello! This is a test message."
                }
              }
            ]
          }
        ]
      },
      message_via_changes: {
        object: "instagram",
        entry: [
          {
            id: "test-page-id-123",
            time: Date.now(),
            changes: [
              {
                field: "messages",
                value: {
                  from: {
                    id: "user-123",
                    username: "test_user"
                  },
                  recipient: {
                    id: "page-456"
                  },
                  timestamp: Date.now().toString(),
                  mid: "message-id-789",
                  text: "Test message via changes array"
                }
              }
            ]
          }
        ]
      },
      mention: {
        object: "instagram",
        entry: [
          {
            id: "test-page-id-123",
            time: Date.now(),
            changes: [
              {
                field: "mentions",
                value: {
                  comment_id: "mention-comment-123",
                  media_id: "story-media-456",
                  from: {
                    id: "user-789",
                    username: "mentioning_user"
                  },
                  text: "@your_account check this out!"
                }
              }
            ]
          }
        ]
      }
    };

    if (type && examples[type]) {
      return {
        success: true,
        type,
        example: examples[type],
        usage: `POST this payload to /instagram/webhook/test to simulate a ${type} webhook event`
      };
    }

    return {
      success: true,
      availableTypes: Object.keys(examples),
      examples,
      usage: "Use ?type=comment|message|message_via_changes|mention to get a specific example"
    };
  }

  @Post("webhook/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Test webhook events with mock data (Development only)",
    description: "Allows testing webhook processing without triggering actual Instagram events. Skips signature verification."
  })
  @ApiResponse({ status: 200, description: "Mock webhook processed successfully" })
  async testWebhook(@Body() body: InstagramWebhookDto) {
    console.log('🧪 Processing test webhook:', JSON.stringify(body, null, 2));

    // Validate webhook structure
    if (!this.webhookValidator.validateWebhookEvent(body)) {
      throw new BadRequestException("Invalid webhook event structure");
    }

    // Process the mock webhook
    await this.processWebhook(body);

    return {
      success: true,
      message: "Mock webhook processed successfully",
      receivedData: body
    };
  }

  /**
   * Process webhook events
   */
  private async processWebhook(
    webhookData: InstagramWebhookDto
  ): Promise<void> {
    try {
      for (const entry of webhookData.entry) {
        // Handle changes-based webhooks (comments, mentions)
        console.log("entry", entry)
        if (entry.changes) {
          const changes = this.webhookValidator.extractChanges(entry);

          console.log("changes", changes)

          for (const change of changes) {
            const { field, value } = change;

            switch (field) {
              case "messages":
                console.log('Processing message from changes array:', value);
                // Transform changes-based message to messaging format
                const messagingItem = {
                  sender: value.sender || value.from,
                  recipient: value.recipient,
                  timestamp: value.timestamp ? parseInt(value.timestamp) : Date.now(),
                  message: value.message || { text: value.text, mid: value.mid }
                };
                await this.instagramService.handleDirectMessageWebhook(messagingItem);
                break;

              case "comments":
                await this.instagramService.handleCommentWebhook(value);
                break;

              case "mentions":
                // Handle story mentions
                // await this.instagramService.handleMentionWebhook(value);
                break;

              default:
                console.log(`Unhandled webhook field: ${field}`);
            }
          }
        }

        // Handle messaging-based webhooks (direct messages)
        if (entry.messaging) {
          for (const messagingItem of entry.messaging) {
            console.log('Processing messaging item:', messagingItem);
            await this.instagramService.handleDirectMessageWebhook(messagingItem);
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }
  }

  // ==================== Messaging & Replies ====================

  @Post("reply/comment")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reply to an Instagram comment" })
  @ApiResponse({ status: 200, description: "Reply sent" })
  async replyToComment(@Body() dto: ReplyToCommentDto) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.replyToComment(dto.commentId, dto.message, accessToken)
    );

    return { success: true, data: result, message: "Reply sent successfully" };
  }

  @Post("reply/message")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reply to an Instagram direct message" })
  @ApiResponse({ status: 200, description: "Message sent" })
  async replyToDirectMessage(@Body() dto: ReplyToDirectMessageDto) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.sendDirectMessage(
        account.platform_user_id,
        dto.recipientId,
        dto.message,
        accessToken
      )
    );

    return {
      success: true,
      data: result,
      message: "Message sent successfully",
    };
  }

  @Get("conversations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get Instagram conversations (DMs)" })
  @ApiResponse({ status: 200, description: "Conversations retrieved" })
  async getConversations(@Query() dto: GetConversationsDto) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getConversations(
        account.platform_user_id,
        accessToken,
        parseInt(dto.limit || "25"),
        dto.after
      )
    );

    return { success: true, data: result };
  }

  @Get("conversations/:conversationId/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get messages from a conversation" })
  @ApiResponse({ status: 200, description: "Messages retrieved" })
  async getMessages(
    @Param("conversationId") conversationId: string,
    @Query() dto: GetMessagesDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getMessages(
        conversationId,
        accessToken,
        parseInt(dto.limit || "25"),
        dto.after
      )
    );

    return { success: true, data: result };
  }

  @Delete("comments/:commentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a comment" })
  @ApiResponse({ status: 200, description: "Comment deleted" })
  async deleteComment(
    @Param("commentId") commentId: string,
    @Query() dto: DeleteCommentDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    await this.circuitBreaker.execute(() =>
      this.apiClient.deleteComment(commentId, accessToken)
    );

    return { success: true, message: "Comment deleted successfully" };
  }

  @Post("comments/:commentId/hide")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Hide/Unhide a comment" })
  @ApiResponse({ status: 200, description: "Comment hidden/unhidden" })
  async hideComment(
    @Param("commentId") commentId: string,
    @Body() dto: HideCommentDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    await this.circuitBreaker.execute(() =>
      this.apiClient.hideComment(commentId, dto.hide === "true", accessToken)
    );

    return {
      success: true,
      message: `Comment ${dto.hide === "true" ? "hidden" : "unhidden"} successfully`,
    };
  }

  // ==================== Media & Posts ====================

  @Get("media")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get Instagram posts/media for an account" })
  @ApiResponse({ status: 200, description: "Media retrieved" })
  async getMedia(@Query() dto: GetMediaListDto) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getMediaList(
        account.platform_user_id,
        accessToken,
        parseInt(dto.limit || "25"),
        dto.after
      )
    );

    return { success: true, data: result };
  }

  @Get("media/:mediaId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get details of a specific media/post" })
  @ApiResponse({ status: 200, description: "Media details retrieved" })
  async getMediaDetails(
    @Param("mediaId") mediaId: string,
    @Query() dto: GetMediaDetailsDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getMediaDetails(mediaId, accessToken, dto.fields)
    );

    return { success: true, data: result };
  }

  @Get("media/:mediaId/comments")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get comments on a media/post" })
  @ApiResponse({ status: 200, description: "Comments retrieved" })
  async getMediaComments(
    @Param("mediaId") mediaId: string,
    @Query() dto: GetMediaCommentsDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getMediaComments(
        mediaId,
        accessToken,
        parseInt(dto.limit || "25"),
        dto.after
      )
    );

    return { success: true, data: result };
  }

  // ==================== Insights & Analytics ====================

  @Get("insights/account")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get account-level insights" })
  @ApiResponse({ status: 200, description: "Account insights retrieved" })
  async getAccountInsights(@Query() dto: GetAccountInsightsDto) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getAccountInsights(
        account.platform_user_id,
        dto.metrics,
        dto.period,
        accessToken,
        dto.since,
        dto.until
      )
    );

    return { success: true, data: result };
  }

  @Get("insights/media/:mediaId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get media-level insights" })
  @ApiResponse({ status: 200, description: "Media insights retrieved" })
  async getMediaInsights(
    @Param("mediaId") mediaId: string,
    @Query() dto: GetMediaInsightsDto
  ) {
    const account = await this.prisma.social_accounts.findUnique({
      where: { account_id: dto.accountId },
    });

    if (!account) {
      throw new BadRequestException("Account not found");
    }

    const accessToken = this.decryptToken(account.access_token);

    const result = await this.circuitBreaker.execute(() =>
      this.apiClient.getMediaInsights(mediaId, dto.metrics, accessToken)
    );

    return { success: true, data: result };
  }

  // ==================== Helper Methods ====================

  private decryptToken(encryptedToken: string): string {
    try {
      // Check if token is in encrypted format (iv:encrypted)
      if (!encryptedToken.includes(':')) {
        // Token is not encrypted, return as-is
        return encryptedToken;
      }

      const algorithm = "aes-256-cbc";
      const appSecret = process.env.FACEBOOK_APP_SECRET || "";

      if (!appSecret) {
        // Return token as-is if no secret configured
        return encryptedToken;
      }

      const key = crypto.scryptSync(appSecret, "salt", 32);
      const parts = encryptedToken.split(":");

      if (parts.length !== 2) {
        return encryptedToken;
      }

      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      // If decryption fails, assume token is stored in plain text
      return encryptedToken;
    }
  }
}
