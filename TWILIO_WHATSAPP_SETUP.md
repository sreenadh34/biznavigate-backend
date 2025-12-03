# Twilio WhatsApp Integration Setup

This guide explains how to set up Twilio for WhatsApp messaging in the BizNavigate backend.

## Overview

The system now uses Twilio's WhatsApp API for sending messages. The integration includes:

- **Message Sending**: Send WhatsApp messages via Twilio
- **NLU Processing**: Extract user message and send to AI for intent detection
- **AI Response**: Process AI results and send appropriate responses

## Prerequisites

1. A Twilio account ([Sign up here](https://www.twilio.com/try-twilio))
2. WhatsApp Business Account connected to Twilio
3. Twilio Account SID and Auth Token

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Your Twilio WhatsApp number

# Optional: Status callback URL for delivery receipts
TWILIO_STATUS_CALLBACK_URL=https://your-domain.com/whatsapp/webhook/status
```

## Setup Steps

### 1. Get Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Copy your **Account SID** and **Auth Token** from the dashboard
3. Add them to your `.env` file

### 2. Configure WhatsApp Sandbox (For Testing)

For development/testing, use Twilio's WhatsApp Sandbox:

1. Go to [Twilio Console > Messaging > Try it out > Send a WhatsApp message](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Send the join code from your WhatsApp to the sandbox number
3. Use `whatsapp:+14155238886` as your `TWILIO_WHATSAPP_NUMBER`

### 3. Set Up Production WhatsApp Number

For production:

1. Request a WhatsApp Business profile
2. Get approval from WhatsApp
3. Configure your production number in Twilio
4. Update `TWILIO_WHATSAPP_NUMBER` with your production number

## How It Works

### Message Flow

```
User sends WhatsApp message
    ↓
Webhook receives message (handleMessageWebhook)
    ↓
Extract message body and sender phone number
    ↓
Send to Kafka for AI/NLU processing
    ↓
AI processes message (detectIntent)
    ↓
Returns intent, entities, and suggested response
    ↓
handleAiResponse processes the result
    ↓
Send response via Twilio (sendAIResponse)
    ↓
User receives response on WhatsApp
```

### Message Processing

1. **Incoming Message** ([whatsapp.service.ts:145](src/features/whatsapp/whatsapp.service.ts#L145))
   - Extracts message body and sender phone number
   - Creates/updates lead record
   - Sends to Kafka for AI processing

2. **AI Processing** ([whatsapp.service.ts:298](src/features/whatsapp/whatsapp.service.ts#L298))
   - Message sent to AI service via Kafka
   - AI detects intent and extracts entities
   - Returns suggested response and actions

3. **Response Handling** ([whatsapp.service.ts:464](src/features/whatsapp/whatsapp.service.ts#L464))
   - Receives AI processing result
   - Generates response (AI-suggested or template-based)
   - Sends via Twilio

### Sending Messages

The `sendMessage` method ([whatsapp.service.ts:402](src/features/whatsapp/whatsapp.service.ts#L402)) now uses Twilio:

```typescript
// Extract message text
const messageText = this.extractMessageText(message);

// Format phone number (Twilio expects format like +1234567890)
const formattedTo = to.startsWith('+') ? to : `+${to}`;

// Send via Twilio
const result = await this.twilioClient.sendWhatsAppMessage(formattedTo, messageText);
```

## Supported Features

### Text Messages
```typescript
await whatsappService.sendMessage(phoneNumberId, to, {
  messaging_product: 'whatsapp',
  to: '+1234567890',
  type: 'text',
  text: {
    body: 'Hello from Twilio!',
    preview_url: true,
  },
});
```

### Media Messages (Future Enhancement)
```typescript
// Coming soon - use twilioClient.sendWhatsAppMessageWithMedia()
```

## Intent Detection & Entity Extraction

The AI service processes incoming messages to:

1. **Detect Intent**: Classify user intent (e.g., ORDER_REQUEST, PRICING_INQUIRY, COMPLAINT)
2. **Extract Entities**: Pull out key information (product names, quantities, dates, etc.)
3. **Suggest Response**: Generate contextual response based on business type
4. **Suggest Actions**: Recommend follow-up actions (create_order, schedule_call, etc.)

Example AI response:
```json
{
  "intent": {
    "intent": "ORDER_REQUEST",
    "confidence": 0.92
  },
  "entities": {
    "product": "Blue T-shirt",
    "size": "Large",
    "quantity": 2
  },
  "suggested_response": "Great! I'd be happy to help you with 2 Large Blue T-shirts. Would you like to proceed with the order?",
  "suggested_actions": ["create_order", "check_inventory"]
}
```

## Template Responses

When AI doesn't provide a response, the system falls back to templates ([whatsapp.service.ts:496](src/features/whatsapp/whatsapp.service.ts#L496)):

- `ORDER_REQUEST`: Prompts for order details
- `PRICING_INQUIRY`: Asks for specific product
- `AVAILABILITY_INQUIRY`: Requests product specification
- `COMPLAINT`: Acknowledges concern and requests details
- `SCHEDULE_CALL`: Asks for preferred time
- `GREETING`: Welcome message
- `GENERAL_INQUIRY`: Generic helpful response

## Testing

### Test Incoming Messages

1. Send a WhatsApp message to your Twilio number
2. Check logs for AI processing:
   ```
   📱 WhatsApp message received from +1234567890
   AI Response - Intent: ORDER_REQUEST, Confidence: 0.92
   Entities extracted: {"product":"T-shirt","size":"L"}
   ```

### Test Outgoing Messages

Use the API endpoint or service method:
```bash
curl -X POST http://localhost:3000/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumberId": "your_phone_id",
    "to": "+1234567890",
    "message": {
      "messaging_product": "whatsapp",
      "type": "text",
      "text": {
        "body": "Test message"
      }
    }
  }'
```

## Troubleshooting

### Messages Not Sending

1. Verify Twilio credentials in `.env`
2. Check that phone number has `whatsapp:` prefix
3. Ensure phone number is in E.164 format (+1234567890)
4. Check Twilio logs in console

### AI Not Processing Messages

1. Verify Kafka is running
2. Check AI service is consuming messages
3. Review Kafka producer/consumer logs

### Webhook Not Receiving Messages

1. Verify webhook URL is configured in Twilio
2. Check webhook verification token
3. Ensure server is publicly accessible (use ngrok for testing)

## Migration from Meta API

The old Meta/Facebook Graph API code is commented out but preserved for reference:

```typescript
// const result = await this.circuitBreaker.execute(
//   `whatsapp-send-${phoneNumberId}`,
//   () => this.apiClient.sendMessage(phoneNumberId, accessToken, message),
// );
```

To switch back to Meta API:
1. Uncomment the Meta API code
2. Comment out the Twilio code
3. Ensure Meta access tokens are configured

## Resources

- [Twilio WhatsApp API Documentation](https://www.twilio.com/docs/whatsapp/api)
- [Twilio Node.js Library](https://www.twilio.com/docs/libraries/node)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)

## Support

For issues or questions:
1. Check Twilio logs in console
2. Review application logs
3. Verify environment variables
4. Test with Twilio sandbox first
