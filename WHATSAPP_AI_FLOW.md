# WhatsApp AI Integration Flow

## Overview
This document explains the complete message flow from WhatsApp through AI processing and back to the user with intent-based actions.

## Architecture

```
┌─────────────┐
│  WhatsApp   │
│   Message   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  WhatsAppController                     │
│  POST /whatsapp/send                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  WhatsAppService                        │
│  - Creates lead_id                      │
│  - Stores message context               │
│  - Registers AI response handler        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  KafkaProducerService                   │
│  Topic: ai.process.request              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Service (External)                  │
│  - Processes message                    │
│  - Detects intent                       │
│  - Extracts entities                    │
│  - Suggests actions                     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  KafkaConsumerService                   │
│  Topic: ai.process.result               │
│  - Stores AI result in DB               │
│  - Calls registered handler             │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  WhatsAppService.handleAiResponse       │
│  - Retrieves message context            │
│  - Processes AI result                  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  WhatsAppMessageHandlerService          │
│  - Determines actions based on intent   │
│  - Generates response message           │
│  - Logs activity                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Actions Execution                      │
│  - Send WhatsApp response               │
│  - Execute business actions             │
│  - Notify relevant teams                │
└─────────────────────────────────────────┘
```

## Message Flow Details

### 1. Incoming Message
**Endpoint:** `POST /whatsapp/send`

**Request:**
```json
{
  "from": "+919539192684",
  "to": "+919539192688",
  "message": "I need 100 units of product X",
  "businessId": "whatsapp-business"
}
```

**What happens:**
- [whatsapp.service.ts:32-77](src/whatsapp/whatsapp.service.ts#L32-L77) receives the message
- Creates a unique `lead_id` (e.g., `whatsapp-lead-mock_msg_1234567890_1`)
- Stores message context in memory
- Registers a callback handler for AI response
- Sends to Kafka topic `ai.process.request`

**Response:**
```json
{
  "success": true,
  "messageId": "mock_msg_1234567890_1",
  "timestamp": "2025-01-24T10:30:00.000Z",
  "to": "+919539192688",
  "message": "I need 100 units of product X",
  "status": "processing"
}
```

### 2. AI Processing Request
**Kafka Topic:** `ai.process.request`

**Message sent to AI:**
```json
{
  "event_id": "uuid-here",
  "event_type": "ai.process.request",
  "timestamp": "2025-01-24T10:30:00.000Z",
  "payload": {
    "lead_id": "whatsapp-lead-mock_msg_1234567890_1",
    "business_id": "whatsapp-business",
    "text": "I need 100 units of product X",
    "business_type": "service",
    "priority": "normal"
  }
}
```

### 3. AI Response
**Kafka Topic:** `ai.process.result`

**AI returns:**
```json
{
  "event_type": "ai.process.result",
  "payload": {
    "lead_id": "whatsapp-lead-mock_msg_1234567890_1",
    "business_id": "whatsapp-business",
    "tenant_id": null,
    "processing_id": "proc-123",
    "intent": {
      "intent": "ORDER_REQUEST",
      "confidence": 0.95
    },
    "entities": {
      "quantity": "100",
      "product": "product X"
    },
    "suggested_actions": ["create_order", "notify_sales"],
    "suggested_response": "Thank you for your order! We'll process 100 units of product X right away.",
    "processing_time_ms": 450
  }
}
```

### 4. Consumer Processing
[kafka-consumer.service.ts:101-125](src/features/kafka/kafka-consumer.service.ts#L101-L125) handles the response:

1. **Stores AI result** in `lead_activities` table
2. **Finds registered handler** for the `lead_id`
3. **Calls handler** with AI result

### 5. WhatsApp Response Handler
[whatsapp.service.ts:82-121](src/whatsapp/whatsapp.service.ts#L82-L121) processes:

1. **Retrieves message context** (from, to, original message)
2. **Calls WhatsAppMessageHandlerService** to process AI result
3. **Sends WhatsApp response** if needed
4. **Executes actions** based on intent
5. **Cleans up** message context

### 6. Message Handler Processing
[whatsapp-message-handler.service.ts:18-56](src/whatsapp/whatsapp-message-handler.service.ts#L18-L56):

**Determines actions based on intent:**
- `ORDER_REQUEST` (confidence > 0.8) → `["create_order", "notify_sales"]`
- `PRICING_INQUIRY` (confidence > 0.8) → `["send_price_list", "assign_to_sales"]`
- `COMPLAINT` (confidence > 0.8) → `["create_ticket", "notify_support", "priority_high"]`
- Medium confidence (0.5-0.8) → `["flag_for_review", "notify_agent"]`
- Low confidence (< 0.5) → `["requires_human_intervention", "notify_supervisor"]`

**Generates response message:**
- Uses AI suggested response if confidence > 0.7
- Otherwise uses template-based responses

### 7. Action Execution
[whatsapp-message-handler.service.ts:170-239](src/whatsapp/whatsapp-message-handler.service.ts#L170-L239):

Each action is executed sequentially:
- `notify_sales` - Sends notification to sales team
- `create_order` - Creates order in system
- `send_price_list` - Sends pricing information
- `create_ticket` - Creates support ticket
- `flag_for_review` - Flags for manual review
- And more...

All actions are logged in `lead_activities` table.

## Supported Intents

| Intent | Confidence | Actions | Response Template |
|--------|-----------|---------|-------------------|
| ORDER_REQUEST | > 0.8 | create_order, notify_sales | "Thank you for your order request! Our team will get back to you shortly..." |
| PRICING_INQUIRY | > 0.8 | send_price_list, assign_to_sales | "Thanks for your interest! Let me share our pricing..." |
| AVAILABILITY_INQUIRY | > 0.8 | check_inventory, send_availability | "Let me check the availability..." |
| COMPLAINT | > 0.8 | create_ticket, notify_support, priority_high | "I'm sorry to hear about this issue..." |
| SCHEDULE_CALL | > 0.8 | create_calendar_event, send_confirmation | "I'd be happy to schedule a call..." |
| GREETING | Any | - | "Hello! Welcome to our service..." |
| UNKNOWN | Any | review_and_respond | "Thank you for your message..." |

## Database Logging

All activities are logged in `lead_activities` table:

1. **AI Result Received** - When AI response is received
2. **AI Processed** - When AI processing is complete with intent/confidence
3. **Action Executed** - When each action is executed
4. **AI Error** - If AI processing fails

## Error Handling

**Kafka Topic:** `ai.error`

[kafka-consumer.service.ts:161-172](src/features/kafka/kafka-consumer.service.ts#L161-L172) handles AI errors:
- Logs error in `lead_activities`
- Marks as `ai_error` type
- Includes error message and type

## Testing the Flow

### Test 1: Order Request
```bash
curl -X POST http://localhost:3000/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+919539192684",
    "to": "+919539192688",
    "message": "I need 100 units of product X"
  }'
```

**Expected:**
- AI detects `ORDER_REQUEST` intent
- System executes `create_order` and `notify_sales` actions
- User receives confirmation message
- Activities logged in database

### Test 2: Pricing Inquiry
```bash
curl -X POST http://localhost:3000/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+919539192684",
    "to": "+919539192688",
    "message": "What are your prices for bulk orders?"
  }'
```

**Expected:**
- AI detects `PRICING_INQUIRY` intent
- System executes `send_price_list` and `assign_to_sales` actions
- User receives pricing information
- Activities logged in database

## Customization

### Adding New Intents
1. Update [whatsapp-message-handler.service.ts:61-82](src/whatsapp/whatsapp-message-handler.service.ts#L61-L82) with new intent actions
2. Add response template in [whatsapp-message-handler.service.ts:126-147](src/whatsapp/whatsapp-message-handler.service.ts#L126-L147)

### Adding New Actions
1. Add action case in [whatsapp-message-handler.service.ts:205-233](src/whatsapp/whatsapp-message-handler.service.ts#L205-L233)
2. Implement action logic
3. Ensure activity logging

### Integrating Real WhatsApp API
Update [whatsapp.service.ts:126-133](src/whatsapp/whatsapp.service.ts#L126-L133) to call actual WhatsApp Business API:

```typescript
private async sendWhatsAppResponse(from: string, to: string, message: string) {
  await this.whatsappClient.sendMessage({
    from,
    to,
    text: message
  });
}
```

## Files Modified/Created

1. ✅ [whatsapp-message-handler.service.ts](src/whatsapp/whatsapp-message-handler.service.ts) - **NEW** - Handles intent processing and actions
2. ✅ [whatsapp.service.ts](src/whatsapp/whatsapp.service.ts) - **UPDATED** - Added AI response handling
3. ✅ [whatsapp.module.ts](src/whatsapp/whatsapp.module.ts) - **UPDATED** - Added new service and PrismaModule
4. ✅ [kafka-consumer.service.ts](src/features/kafka/kafka-consumer.service.ts) - **UPDATED** - Added handler registration and AI result storage

## Next Steps

1. **Implement WhatsApp Business API integration** - Replace mock responses with actual API calls
2. **Add webhook endpoint** - To receive incoming WhatsApp messages
3. **Implement action handlers** - Complete TODOs in `executeAction` method
4. **Add conversation context** - Track conversation history for better AI responses
5. **Add rate limiting** - Prevent spam and abuse
6. **Add authentication** - Secure the webhook endpoint
7. **Add monitoring** - Track success rates, response times, etc.
