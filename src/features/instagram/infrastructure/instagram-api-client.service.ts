import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

@Injectable()
export class InstagramApiClientService {
  private readonly logger = new Logger(InstagramApiClientService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly graphApiUrl: string;
  private readonly apiVersion: string;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.graphApiUrl = this.configService.get<string>('instagram.graphApiUrl');
    this.apiVersion = this.configService.get<string>('instagram.apiVersion');
    this.appId = this.configService.get<string>('instagram.appId');
    this.appSecret = this.configService.get<string>('instagram.appSecret');

    this.axiosInstance = axios.create({
      baseURL: `${this.graphApiUrl}/${this.apiVersion}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`Instagram API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Instagram API Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      },
    );
  }

  /**
   * OAuth - Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/oauth/access_token', {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          code,
          redirect_uri: redirectUri,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token:', error);
      throw new HttpException(
        'Failed to exchange authorization code for access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * OAuth - Exchange short-lived token for long-lived token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get long-lived token:', error);
      throw new HttpException(
        'Failed to exchange for long-lived token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * OAuth - Refresh access token
   */
  async refreshAccessToken(currentToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: currentToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh access token:', error);
      throw new HttpException(
        'Failed to refresh access token',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get Instagram Business Accounts connected to a Facebook Page
   */
  async getInstagramAccounts(facebookPageId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${facebookPageId}`, {
        params: {
          fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}',
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Instagram accounts:', error);
      throw new HttpException(
        'Failed to fetch Instagram business accounts',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get user's Instagram Business Account info
   */
  async getAccountInfo(instagramUserId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${instagramUserId}`, {
        params: {
          fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get account info:', error);
      throw new HttpException(
        'Failed to fetch Instagram account info',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Comments - Reply to a comment
   */
  async replyToComment(commentId: string, message: string, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/${commentId}/replies`,
        {
          message,
        },
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      this.logger.log(`Replied to comment ${commentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to reply to comment:', error);
      throw new HttpException('Failed to reply to comment', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Comments - Get comment details
   */
  async getComment(commentId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${commentId}`, {
        params: {
          fields: 'id,text,username,timestamp,from,media,parent_id',
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get comment:', error);
      throw new HttpException('Failed to fetch comment', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Comments - Delete a comment
   */
  async deleteComment(commentId: string, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.delete(`/${commentId}`, {
        params: {
          access_token: accessToken,
        },
      });

      this.logger.log(`Deleted comment ${commentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to delete comment:', error);
      throw new HttpException('Failed to delete comment', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Comments - Hide/Unhide a comment
   */
  async hideComment(commentId: string, hide: boolean, accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/${commentId}`,
        {
          hide,
        },
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      this.logger.log(`${hide ? 'Hidden' : 'Unhidden'} comment ${commentId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to hide/unhide comment:', error);
      throw new HttpException('Failed to hide/unhide comment', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Direct Messages - Send a message
   */
  async sendDirectMessage(
    instagramUserId: string,
    recipientId: string,
    message: string,
    accessToken: string,
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/${instagramUserId}/messages`,
        {
          recipient: {
            id: recipientId,
          },
          message: {
            text: message,
          },
        },
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      this.logger.log(`Sent DM to ${recipientId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to send direct message:', error);
      throw new HttpException('Failed to send direct message', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Direct Messages - Get conversations
   */
  async getConversations(
    instagramUserId: string,
    accessToken: string,
    limit: number = 25,
    after?: string,
  ): Promise<any> {
    try {
      const params: any = {
        fields: 'id,messages{id,created_time,from,to,message},participants,updated_time',
        access_token: accessToken,
        limit,
      };

      if (after) {
        params.after = after;
      }

      const response = await this.axiosInstance.get(`/${instagramUserId}/conversations`, {
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get conversations:', error);
      throw new HttpException('Failed to fetch conversations', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Direct Messages - Get messages from a conversation
   */
  async getMessages(
    conversationId: string,
    accessToken: string,
    limit: number = 25,
    after?: string,
  ): Promise<any> {
    try {
      const params: any = {
        fields: 'id,created_time,from,to,message',
        access_token: accessToken,
        limit,
      };

      if (after) {
        params.after = after;
      }

      const response = await this.axiosInstance.get(`/${conversationId}/messages`, {
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get messages:', error);
      throw new HttpException('Failed to fetch messages', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Media - Get user's media (posts)
   */
  async getMediaList(
    instagramUserId: string,
    accessToken: string,
    limit: number = 25,
    after?: string,
  ): Promise<any> {
    try {
      const params: any = {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count',
        access_token: accessToken,
        limit,
      };

      if (after) {
        params.after = after;
      }

      const response = await this.axiosInstance.get(`/${instagramUserId}/media`, {
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get media list:', error);
      throw new HttpException('Failed to fetch media list', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Media - Get media details
   */
  async getMediaDetails(mediaId: string, accessToken: string, fields?: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${mediaId}`, {
        params: {
          fields: fields || 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count,is_comment_enabled,owner',
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get media details:', error);
      throw new HttpException('Failed to fetch media details', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Media - Get comments on a media
   */
  async getMediaComments(
    mediaId: string,
    accessToken: string,
    limit: number = 25,
    after?: string,
  ): Promise<any> {
    try {
      const params: any = {
        fields: 'id,text,username,timestamp,from,replies{id,text,username,timestamp}',
        access_token: accessToken,
        limit,
      };

      if (after) {
        params.after = after;
      }

      const response = await this.axiosInstance.get(`/${mediaId}/comments`, {
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get media comments:', error);
      throw new HttpException('Failed to fetch media comments', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Insights - Get account-level insights
   */
  async getAccountInsights(
    instagramUserId: string,
    metrics: string[],
    period: string,
    accessToken: string,
    since?: string,
    until?: string,
  ): Promise<any> {
    try {
      const params: any = {
        metric: metrics.join(','),
        period,
        access_token: accessToken,
      };

      if (since) params.since = since;
      if (until) params.until = until;

      const response = await this.axiosInstance.get(`/${instagramUserId}/insights`, {
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get account insights:', error);
      throw new HttpException('Failed to fetch account insights', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Insights - Get media-level insights
   */
  async getMediaInsights(mediaId: string, metrics: string[], accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${mediaId}/insights`, {
        params: {
          metric: metrics.join(','),
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get media insights:', error);
      throw new HttpException('Failed to fetch media insights', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Mentions - Get mentions in stories
   */
  async getMentions(
    instagramUserId: string,
    accessToken: string,
    limit: number = 25,
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/${instagramUserId}/stories`, {
        params: {
          fields: 'id,media_type,media_url,timestamp,username',
          access_token: accessToken,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get mentions:', error);
      throw new HttpException('Failed to fetch mentions', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Error handling for Instagram API errors
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      this.logger.error(
        `Instagram API Error: ${status} - ${JSON.stringify(data)}`,
      );

      // Handle specific Instagram API error codes
      switch (status) {
        case 400:
          this.logger.error('Bad Request - Invalid parameters');
          break;
        case 401:
          this.logger.error('Unauthorized - Invalid or expired access token');
          break;
        case 403:
          this.logger.error('Forbidden - Insufficient permissions');
          break;
        case 404:
          this.logger.error('Not Found - Resource does not exist');
          break;
        case 429:
          this.logger.error('Rate Limit Exceeded');
          break;
        case 500:
          this.logger.error('Instagram API Server Error');
          break;
        default:
          this.logger.error(`Unexpected error: ${status}`);
      }
    } else if (error.request) {
      this.logger.error('No response received from Instagram API');
    } else {
      this.logger.error('Error setting up Instagram API request:', error.message);
    }
  }
}
