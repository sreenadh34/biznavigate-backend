import { registerAs } from '@nestjs/config';

export default registerAs('whatsapp', () => ({
  // Facebook App credentials (shared with Instagram - both use Meta/Facebook Graph API)
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',

  // API configuration
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  graphApiUrl: 'https://graph.facebook.com',

  // Webhook configuration
  webhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || '',

  // WhatsApp Business API configuration
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',

  // Token configuration
  tokenRefreshBuffer: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  longLivedTokenExpiry: 60 * 24 * 60 * 60 * 1000, // 60 days

  // Rate limiting (WhatsApp Business API limits)
  maxMessagesPerSecond: 80, // 80 messages per second
  maxMessagesPerDay: 100000, // Varies by tier, this is for Tier 2

  // Message template configuration
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',

  // Media configuration
  maxMediaSizeBytes: 16 * 1024 * 1024, // 16 MB max file size
  supportedImageFormats: ['image/jpeg', 'image/png'],
  supportedVideoFormats: ['video/mp4', 'video/3gpp'],
  supportedAudioFormats: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  supportedDocumentFormats: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],

  // Message window
  customerServiceWindow: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
  retryBackoffMultiplier: 2,

  // Circuit breaker configuration
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 60 seconds
    resetTimeout: 300000, // 5 minutes
  },

  // Feature flags
  features: {
    enableMessageReactions: true,
    enableInteractiveMessages: true,
    enableMediaMessages: true,
    enableTemplateMessages: true,
    enableLocationMessages: true,
    enableContactMessages: true,
  },
}));
