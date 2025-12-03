# Chat Continuity & Conversation History Guide

This guide explains how the system maintains context and continuity across WhatsApp conversations.

## Overview

The chat continuity system ensures that the AI has full context of the conversation when processing new messages. This allows for:

- **Contextual responses** based on previous messages
- **Follow-up handling** (e.g., "What about blue?" after asking about red shirts)
- **Multi-turn conversations** with proper context
- **Entity tracking** across multiple messages
- **Intent persistence** (e.g., continuing an order from previous messages)

## How It Works

### 1. Message Storage

Every message (inbound and outbound) is stored in the database with:

```typescript
{
  conversation_id: string,      // Links messages to conversation
  sender_type: 'lead' | 'business',
  message_text: string,
  message_type: string,
  created_at: timestamp,
  // ... other fields
}
```

**Location**: [whatsapp.service.ts:260-273](src/features/whatsapp/whatsapp.service.ts#L260-L273)

### 2. Conversation History Retrieval

When a new message arrives, the system retrieves the last 10 messages from the conversation:

```typescript
const conversationHistory = await this.getConversationHistory(
  conversation.conversation_id,
  10, // Last 10 messages
);
```

**Method**: [whatsapp.service.ts:623-657](src/features/whatsapp/whatsapp.service.ts#L623-L657)

The history is retrieved in chronological order (oldest first) and formatted as:

```typescript
[
  {
    role: 'user',           // 'user' for lead, 'assistant' for business
    content: 'I want to order a shirt',
    timestamp: '2024-01-01T10:00:00Z',
    message_type: 'text'
  },
  {
    role: 'assistant',
    content: 'Great! What size would you like?',
    timestamp: '2024-01-01T10:00:05Z',
    message_type: 'text'
  },
  {
    role: 'user',
    content: 'Medium please',
    timestamp: '2024-01-01T10:00:15Z',
    message_type: 'text'
  }
]
```

### 3. AI Processing with Context

The conversation history is sent to the AI service along with the new message:

```typescript
await this.kafkaProducer.requestAiProcessing({
  lead_id: lead.lead_id,
  business_id: account.business_id,
  text: messageText,                      // Current message
  business_type: mappedBusinessType,
  conversation_history: conversationHistory, // Past messages
  context: {
    // Additional context data
  },
  priority: 'normal',
});
```

**Location**: [whatsapp.service.ts:307-331](src/features/whatsapp/whatsapp.service.ts#L307-L331)

### 4. AI Uses History for Context

The AI service can now:

1. **Understand references** to previous messages
   - "What about blue?" → AI knows user was asking about shirt colors
   - "Add that to my cart" → AI knows what product was discussed

2. **Track multi-step processes**
   - Order flow: Product → Size → Color → Quantity → Confirm
   - Each step builds on previous context

3. **Maintain entity state**
   - User mentioned "size: Large" 3 messages ago
   - AI remembers this when processing new messages

4. **Detect intent changes**
   - User was ordering, now asking about pricing
   - AI can switch context appropriately

## Example Conversation Flow

### Without Continuity ❌
```
User: I want a shirt
Bot: What size?
User: Large
Bot: How can I help you? (context lost)
```

### With Continuity ✅
```
User: I want a shirt
Bot: What size would you like?
User: Large
Bot: Great! I've noted size Large. What color would you prefer?
User: Blue
Bot: Perfect! I'm processing your order for a Large Blue shirt.
```

## Database Schema

### Conversations Table
```sql
lead_conversations:
  - conversation_id (PK)
  - lead_id (FK)
  - business_id (FK)
  - channel (whatsapp, instagram, etc.)
  - status (active, closed)
  - started_at
  - ended_at
```

### Messages Table
```sql
lead_messages:
  - message_id (PK)
  - conversation_id (FK)
  - lead_id (FK)
  - sender_type (lead, business)
  - message_text
  - message_type
  - created_at
  - platform_message_id
  - delivery_status
```

## Configuration

### History Limit

You can adjust how many messages are included in the context:

```typescript
// In whatsapp.service.ts:302-305
const conversationHistory = await this.getConversationHistory(
  conversation.conversation_id,
  10, // Change this number (default: 10)
);
```

**Considerations**:
- **More messages** = Better context but higher AI processing cost
- **Fewer messages** = Lower cost but may lose context
- **Recommended**: 5-15 messages for most use cases

### Context Cleanup

Pending message contexts are automatically cleaned up after 10 minutes:

```typescript
setTimeout(() => {
  this.pendingMessages.delete(leadMessage.message_id);
}, 600000); // 10 minutes
```

**Location**: [whatsapp.service.ts:351-353](src/features/whatsapp/whatsapp.service.ts#L351-L353)

## Advanced Features

### Lead Information in Context

The system also includes lead details for personalization:

```typescript
lead_info: {
  lead_id: lead.lead_id,
  first_name: lead.first_name,
  last_name: lead.last_name,
  status: lead.status,
  lead_score: lead.lead_score,
}
```

**Location**: [whatsapp.service.ts:322-328](src/features/whatsapp/whatsapp.service.ts#L322-L328)

This allows the AI to:
- Address users by name
- Adjust responses based on lead status
- Prioritize high-value leads

### Business Context

Business information is included for domain-specific responses:

```typescript
context: {
  business_name: account.businesses.business_name,
  business_type: mappedBusinessType, // retail, service, d2c, etc.
}
```

This helps the AI:
- Use appropriate terminology
- Follow industry best practices
- Provide relevant suggestions

## Conversation Lifecycle

### 1. New Conversation
```
User sends first message
  ↓
System creates lead record
  ↓
System creates conversation record
  ↓
First message stored with conversation_id
  ↓
AI processes with empty history
```

### 2. Ongoing Conversation
```
User sends follow-up message
  ↓
System finds existing conversation
  ↓
Retrieves last 10 messages
  ↓
AI processes with full context
  ↓
Response sent and stored
```

### 3. Conversation Closure
```
Admin marks conversation as closed
  ↓
conversation.status = 'closed'
  ↓
New message creates new conversation
  ↓
Fresh context starts
```

## Data Retention

### Message History
- All messages are stored indefinitely by default
- Can be configured for GDPR compliance
- Soft delete recommended for audit trails

### Active Conversations
- Conversations remain "active" until manually closed
- Inactive conversations (24h+ no activity) can be auto-closed
- Business rules can determine closure logic

## Performance Considerations

### Database Queries
The history retrieval is optimized with:
- Index on `conversation_id`
- Index on `created_at` for ordering
- Limited row fetch (LIMIT 10)

```sql
CREATE INDEX idx_messages_conversation ON lead_messages(conversation_id, created_at DESC);
```

### Kafka Message Size
- Average history: ~2-5KB per message
- 10 messages: ~20-50KB total
- Kafka default max: 1MB (plenty of room)

### AI Processing Time
- With history: ~1-3 seconds
- Without history: ~0.5-1 second
- Trade-off: Better responses worth the extra time

## Monitoring & Debugging

### Check Conversation History
```typescript
const history = await whatsappService.getConversationHistory(
  conversationId,
  10
);
console.log('Conversation history:', history);
```

### Verify Context Sent to AI
Check Kafka logs for the AI processing event:
```json
{
  "event_type": "ai.process.request",
  "payload": {
    "lead_id": "...",
    "text": "Current message",
    "conversation_history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
}
```

### Common Issues

#### Lost Context
- **Symptom**: AI doesn't remember previous messages
- **Check**: Verify `conversation_history` is in Kafka payload
- **Fix**: Ensure conversation_id is consistent

#### Wrong History Order
- **Symptom**: AI confused by message order
- **Check**: Verify messages are chronological (oldest first)
- **Fix**: Check `reverse()` in getConversationHistory

#### Missing Messages
- **Symptom**: Some messages not in history
- **Check**: Verify messages are being saved to database
- **Fix**: Check lead_messages insert logic

## Best Practices

### 1. Keep History Focused
- 10 messages covers most conversation needs
- For complex flows, increase to 15-20
- Beyond 20, AI may get confused by too much context

### 2. Clean Old Conversations
- Close inactive conversations after 24-48 hours
- Start fresh context for returning users
- Archive old history for analytics

### 3. Handle Context Switching
- Detect when user changes topic completely
- Consider creating new conversation
- Clear irrelevant context

### 4. Privacy & Security
- Don't log sensitive information in message_text
- Encrypt PII in database
- Follow GDPR right-to-deletion rules

## Future Enhancements

### Planned Features
- [ ] Conversation summarization (condense long histories)
- [ ] Smart context pruning (remove irrelevant messages)
- [ ] Cross-channel context (link WhatsApp + Instagram conversations)
- [ ] Semantic search in history (find relevant past messages)
- [ ] Conversation analytics dashboard

### Configuration Options
- [ ] Per-business history limits
- [ ] Auto-close conversation rules
- [ ] Context TTL (time-to-live)
- [ ] Privacy-preserving history (anonymize after N days)

## API Examples

### Get Conversation for Lead
```typescript
const conversation = await prisma.lead_conversations.findFirst({
  where: {
    lead_id: leadId,
    channel: 'whatsapp',
    status: 'active',
  },
  include: {
    lead_messages: {
      orderBy: { created_at: 'asc' },
      take: 50,
    },
  },
});
```

### Create Manual Message (for testing)
```typescript
await prisma.lead_messages.create({
  data: {
    conversation_id: conversationId,
    lead_id: leadId,
    business_id: businessId,
    tenant_id: tenantId,
    sender_type: 'business',
    message_text: 'Test message',
    message_type: 'text',
    delivery_status: 'sent',
  },
});
```

## Related Documentation

- [TWILIO_WHATSAPP_SETUP.md](TWILIO_WHATSAPP_SETUP.md) - WhatsApp integration setup
- [Kafka Integration](src/features/kafka/) - Event streaming
- [AI Service Documentation](src/features/ai/) - NLU processing

## Support

For issues or questions about chat continuity:
1. Check conversation_id consistency
2. Verify messages are being stored
3. Review Kafka logs for AI requests
4. Test with simple conversations first
