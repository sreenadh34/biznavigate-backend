import { registerAs } from '@nestjs/config';

export default registerAs('twilio', () => ({
  // Twilio Account credentials
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',

  // WhatsApp configuration
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886', // Twilio Sandbox number by default

  // Optional: Phone number for SMS
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',

  // Webhook configuration
  statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || '',

  // Rate limiting
  maxMessagesPerSecond: 10, // Twilio's default rate limit

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
}));
