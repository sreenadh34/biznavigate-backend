import { registerAs } from '@nestjs/config';

export default registerAs('instagram', () => ({
  // Facebook App credentials
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',

  // API configuration
  apiVersion: process.env.INSTAGRAM_API_VERSION || 'v18.0',
  graphApiUrl: 'https://graph.facebook.com',

  // Webhook configuration
  webhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || '',

  // OAuth configuration
  oauthRedirectUri: process.env.INSTAGRAM_OAUTH_REDIRECT_URI || 'http://localhost:3006/instagram/auth/callback',
  oauthScopes: [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'instagram_manage_messages',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_show_list',
  ],

  // Token configuration
  tokenRefreshBuffer: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  shortLivedTokenExpiry: 60 * 60 * 1000, // 1 hour
  longLivedTokenExpiry: 60 * 24 * 60 * 60 * 1000, // 60 days

  // Rate limiting
  maxRequestsPerSecond: 200,
  maxRequestsPerHour: 4800,

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // milliseconds

  // Circuit breaker configuration
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000, // 10 seconds
    resetTimeout: 30000, // 30 seconds
  },
}));
