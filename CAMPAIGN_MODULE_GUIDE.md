# Campaign Module Guide

## Overview

The Campaign Module is a comprehensive WhatsApp marketing campaign system designed to handle thousands of messages simultaneously. It includes audience segmentation, WhatsApp template integration, product/image management, and real-time analytics.

## Key Features

- **Audience Segmentation**: Target leads, customers, or custom segments with advanced filtering
- **WhatsApp Business API Integration**: Uses pre-approved templates to avoid approval delays
- **Product/Image Integration**: Reuse product images or upload new campaign media
- **Scalable Delivery**: BullMQ handles thousands of concurrent messages with rate limiting
- **Real-time Analytics**: Track sent, delivered, failed, clicked, and converted metrics
- **Automatic Retry**: Failed messages retry with exponential backoff

## Database Schema Enhancements

The following columns were added to the `campaigns` table:

```sql
-- WhatsApp Template Support
template_id                    -- Reference to reusable templates
whatsapp_template_name         -- WhatsApp Business API approved template name
whatsapp_template_language     -- Template language (en, hi, ta, etc.)
template_parameters            -- Dynamic parameters for template variables

-- Media & Product Integration
media_url                      -- URL of campaign image/video
media_type                     -- Type: image, video, document
product_id                     -- Reference to product for image reuse

-- Audience Segmentation
audience_type                  -- all, leads, customers, segment, custom
audience_filter                -- JSON filter criteria

-- Analytics Counters
total_recipients               -- Total audience size
sent_count                     -- Successfully sent messages
delivered_count                -- Delivered messages
failed_count                   -- Failed deliveries
clicked_count                  -- Link clicks
converted_count                -- Conversions
completed_at                   -- Campaign completion timestamp
updated_at                     -- Last update timestamp
```

## Architecture

### Services

1. **CampaignService** [campaign.service.ts:338](src/features/campaigns/application/services/campaign.service.ts)
   - Campaign CRUD operations
   - Orchestrates audience selection and message queuing
   - Tracks campaign progress and completion

2. **AudienceSegmentationService** [audience-segmentation.service.ts:364](src/features/campaigns/application/services/audience-segmentation.service.ts)
   - Fetches and filters leads/customers
   - Deduplicates by phone number
   - Preview and sampling capabilities

3. **WhatsAppSenderService** [whatsapp-sender.service.ts:233](src/features/campaigns/application/services/whatsapp-sender.service.ts)
   - WhatsApp Business API integration
   - Rate limiting: 100ms between messages = 600 msg/min
   - Template, text, and media message support

4. **CampaignMessageProcessor** [campaign-message.processor.ts:267](src/features/campaigns/processors/campaign-message.processor.ts)
   - BullMQ processor with concurrency=10
   - Placeholder replacement ({{name}}, {{phone}}, etc.)
   - Updates campaign counters and recipient status

### Message Flow

```
User Creates Campaign
        ↓
Audience Segmentation Service
   (Fetches leads/customers with filters)
        ↓
Campaign Service
   (Creates campaign + recipients records)
        ↓
BullMQ Queue (campaign-messages)
   (Batches of 100 jobs added)
        ↓
Campaign Message Processor
   (10 concurrent workers)
        ↓
WhatsApp Sender Service
   (Rate limited: 600 msg/min)
        ↓
WhatsApp Business API
        ↓
Campaign Analytics Updated
```

## API Endpoints

### 1. Preview Audience

**POST** `/campaigns/audience/preview`

Preview audience size and sample before creating campaign.

**Request**:
```json
{
  "businessId": "business-uuid",
  "audienceType": "leads",
  "filter": {
    "status": ["new", "contacted"],
    "quality": ["hot", "warm"],
    "city": "Mumbai"
  }
}
```

**Response**:
```json
{
  "count": 1523,
  "sample": [
    {
      "name": "Rajesh Kumar",
      "phone": "+919876543210",
      "email": "rajesh@example.com"
    },
    {
      "name": "Priya Sharma",
      "phone": "+919876543211",
      "email": "priya@example.com"
    }
  ]
}
```

### 2. Create Campaign

**POST** `/campaigns`

Create a new campaign with audience targeting and WhatsApp template.

**Request Example 1**: Using WhatsApp Template
```json
{
  "businessId": "business-uuid-here",
  "campaignName": "Diwali Sale 2024",
  "campaignType": "promotional",
  "audienceType": "customers",
  "audienceFilter": {
    "totalSpent": { "gte": 1000 },
    "lastOrderDays": { "lte": 90 }
  },
  "channel": "whatsapp",
  "whatsappTemplateName": "diwali_sale_2024",
  "whatsappTemplateLanguage": "en",
  "templateParameters": [
    "Rajesh",
    "50% OFF",
    "Nov 10-15"
  ],
  "mediaUrl": "https://example.com/diwali-banner.jpg",
  "mediaType": "image"
}
```

**Request Example 2**: Using Product Image
```json
{
  "businessId": "business-uuid-here",
  "campaignName": "New Course Launch",
  "campaignType": "announcement",
  "audienceType": "leads",
  "audienceFilter": {
    "quality": ["hot", "warm"]
  },
  "channel": "whatsapp",
  "productId": "product-uuid-here",  // Auto-fetches product image
  "whatsappTemplateName": "course_launch",
  "whatsappTemplateLanguage": "hi",
  "templateParameters": [
    "{{name}}",
    "Data Science Master Class",
    "Jan 15, 2025"
  ]
}
```

**Response**:
```json
{
  "campaignId": "campaign-uuid",
  "campaignName": "Diwali Sale 2024",
  "status": "draft",
  "totalRecipients": 1523,
  "audienceType": "customers",
  "createdAt": "2024-11-02T12:00:00Z"
}
```

### 3. Send Campaign

**POST** `/campaigns/send`

Send a campaign immediately (queues messages to BullMQ).

**Request**:
```json
{
  "campaignId": "campaign-uuid-here"
}
```

**Response**:
```json
{
  "campaignId": "campaign-uuid",
  "status": "active",
  "totalRecipients": 1523,
  "message": "Campaign queued for delivery. 1523 messages will be sent."
}
```

### 4. Get Campaign Stats

**GET** `/campaigns/:id/stats`

Real-time campaign analytics.

**Response**:
```json
{
  "campaignId": "campaign-uuid",
  "campaignName": "Diwali Sale 2024",
  "status": "completed",
  "totalRecipients": 1523,
  "sentCount": 1520,
  "deliveredCount": 1510,
  "failedCount": 3,
  "clickedCount": 342,
  "convertedCount": 87,
  "deliveryRate": 99.34,
  "clickRate": 22.65,
  "conversionRate": 5.77,
  "startedAt": "2024-11-02T12:05:00Z",
  "completedAt": "2024-11-02T12:47:00Z",
  "duration": "42 minutes"
}
```

### 5. List Campaigns

**GET** `/campaigns?businessId=uuid&page=1&limit=20`

**Response**:
```json
{
  "campaigns": [
    {
      "campaignId": "campaign-uuid-1",
      "campaignName": "Diwali Sale 2024",
      "status": "completed",
      "totalRecipients": 1523,
      "sentCount": 1520,
      "createdAt": "2024-11-02T12:00:00Z"
    },
    {
      "campaignId": "campaign-uuid-2",
      "campaignName": "New Course Launch",
      "status": "active",
      "totalRecipients": 842,
      "sentCount": 325,
      "createdAt": "2024-11-01T15:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

## Complete Flow Example

### Scenario: Diwali Sale Campaign to Top Customers

**Step 1**: Preview Audience
```bash
curl -X POST http://localhost:8000/campaigns/audience/preview \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "businessId": "biz-123",
    "audienceType": "customers",
    "filter": {
      "totalSpent": { "gte": 5000 },
      "engagementScore": { "gte": 7 }
    }
  }'
```

**Response**: 523 customers match the criteria

**Step 2**: Create Campaign
```bash
curl -X POST http://localhost:8000/campaigns \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "businessId": "biz-123",
    "campaignName": "Diwali VIP Sale - Top Customers",
    "campaignType": "promotional",
    "audienceType": "customers",
    "audienceFilter": {
      "totalSpent": { "gte": 5000 },
      "engagementScore": { "gte": 7 }
    },
    "channel": "whatsapp",
    "whatsappTemplateName": "vip_diwali_sale",
    "whatsappTemplateLanguage": "en",
    "templateParameters": ["{{name}}", "70% OFF", "Nov 1-5"],
    "mediaUrl": "https://cdn.example.com/diwali-vip-banner.jpg",
    "mediaType": "image"
  }'
```

**Response**: Campaign created with 523 recipients

**Step 3**: Send Campaign
```bash
curl -X POST http://localhost:8000/campaigns/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "campaignId": "campaign-abc-123"
  }'
```

**What Happens**:
1. Campaign status changes to "active"
2. 523 `campaign_recipients` records created with status="queued"
3. Messages queued to BullMQ in batches of 100
4. 10 concurrent workers process messages
5. WhatsApp Sender applies rate limiting (100ms between messages)
6. Each message:
   - Replaces {{name}} with actual customer name
   - Sends via WhatsApp Business API
   - Updates recipient status to "sent" or "failed"
   - Increments campaign counters

**Step 4**: Track Progress
```bash
curl -X GET http://localhost:8000/campaigns/campaign-abc-123/stats \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response** (after 5 minutes):
```json
{
  "campaignId": "campaign-abc-123",
  "status": "active",
  "totalRecipients": 523,
  "sentCount": 312,
  "deliveredCount": 305,
  "failedCount": 2,
  "clickedCount": 47,
  "deliveryRate": 97.76,
  "clickRate": 15.27
}
```

**Step 5**: Final Stats (after completion)
```bash
curl -X GET http://localhost:8000/campaigns/campaign-abc-123/stats \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response**:
```json
{
  "campaignId": "campaign-abc-123",
  "status": "completed",
  "totalRecipients": 523,
  "sentCount": 521,
  "deliveredCount": 518,
  "failedCount": 2,
  "clickedCount": 142,
  "convertedCount": 38,
  "deliveryRate": 99.62,
  "clickRate": 27.42,
  "conversionRate": 7.34,
  "completedAt": "2024-11-02T12:15:00Z",
  "duration": "8 minutes"
}
```

## Audience Segmentation Filters

### For Leads (`audienceType: "leads"`)

```json
{
  "status": ["new", "contacted", "qualified"],
  "quality": ["hot", "warm", "cold"],
  "tags": ["webinar-attendee", "ebook-download"],
  "city": "Mumbai",
  "state": "Maharashtra",
  "assignedUserId": "user-uuid"
}
```

### For Customers (`audienceType: "customers"`)

```json
{
  "engagementScore": { "gte": 5, "lte": 10 },
  "totalSpent": { "gte": 1000, "lte": 50000 },
  "totalOrders": { "gte": 3 },
  "lastOrderDays": { "lte": 90 },
  "tags": ["vip", "repeat-buyer"]
}
```

### Custom Segments

```json
{
  "audienceType": "custom",
  "customRecipients": [
    {
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com"
    },
    {
      "name": "Jane Smith",
      "phone": "+919876543211",
      "email": "jane@example.com"
    }
  ]
}
```

## WhatsApp Template Guidelines

### Template Structure

WhatsApp Business API requires pre-approved templates. Example:

**Template Name**: `diwali_sale_2024`
**Language**: `en`
**Template Content**:
```
Hello {{1}},

🎉 Exclusive Diwali Offer Just for You! 🎉

Get {{2}} on ALL products from {{3}}

Shop now: https://example.com/diwali-sale

*Terms & conditions apply
```

**Parameters**:
- `{{1}}`: Customer name
- `{{2}}`: Discount percentage
- `{{3}}`: Sale dates

### Using Templates in Campaigns

```json
{
  "whatsappTemplateName": "diwali_sale_2024",
  "whatsappTemplateLanguage": "en",
  "templateParameters": [
    "Rajesh Kumar",
    "50% OFF",
    "November 10-15"
  ]
}
```

### Dynamic Placeholders

Use placeholders that auto-replace from recipient data:

- `{{name}}` → Recipient's full name
- `{{firstName}}` → First name only
- `{{phone}}` → Phone number
- `{{email}}` → Email address

## Rate Limiting & Scalability

### Configuration

- **Rate Limit**: 100ms between messages = 600 messages/minute
- **Concurrency**: 10 workers process messages simultaneously
- **Batch Size**: 100 jobs queued at a time
- **Retry Logic**: 3 attempts with exponential backoff (2s, 4s, 8s)

### Performance Metrics

| Recipients | Estimated Time | Throughput |
|-----------|---------------|-----------|
| 100       | ~1 minute     | 600/min   |
| 1,000     | ~10 minutes   | 600/min   |
| 10,000    | ~100 minutes  | 600/min   |
| 50,000    | ~8.3 hours    | 600/min   |

### Scaling Up

To handle more messages:

1. **Increase Concurrency**:
   ```typescript
   @Processor('campaign-messages', {
     concurrency: 20, // Process 20 messages concurrently
   })
   ```

2. **Add More Workers**:
   Deploy multiple instances of the application. BullMQ automatically distributes jobs across workers.

3. **Adjust Rate Limiting**:
   ```typescript
   private readonly minDelayMs = 50; // 50ms = 1200 msg/min
   ```

## Error Handling

### Failed Messages

Messages fail for several reasons:
- Invalid phone number
- WhatsApp Business API errors
- Network timeouts
- Template not approved

Failed messages are tracked in `campaign_recipients.status = 'failed'` with `error_message`.

### Retry Logic

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
}
```

### Manual Retry

To retry failed messages:

```bash
curl -X POST http://localhost:8000/campaigns/campaign-abc-123/retry-failed \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Best Practices

1. **Always Preview Audience First**: Avoid accidentally targeting wrong audience
2. **Use Pre-Approved Templates**: Submit templates to WhatsApp for approval before campaigns
3. **Test with Small Batch**: Create test campaign with 5-10 recipients first
4. **Monitor Analytics**: Check campaign stats every 5-10 minutes
5. **Product Images**: Reuse product images to maintain consistency
6. **Segment Wisely**: Target high-engagement customers for better conversion
7. **Timing Matters**: Send campaigns during business hours (10 AM - 7 PM)
8. **Personalize**: Use dynamic placeholders for better engagement

## Troubleshooting

### Campaign Not Sending

**Check**:
1. Campaign status is "active"
2. Redis server is running
3. BullMQ queue is processing: `/bashes` command
4. WhatsApp Business API credentials are configured

### Low Delivery Rate

**Common Causes**:
- Invalid phone numbers (not in E.164 format)
- Customers blocked your business number
- WhatsApp Business API rate limits exceeded
- Network connectivity issues

### TypeScript Compilation Errors

If you see Prisma type errors after migration:
1. Run: `npx prisma db pull`
2. Run: `npx prisma generate`
3. Restart dev server: Kill and restart `npm run start:dev`

## Migration Script

The campaign enhancements were applied using:

```bash
node apply-campaign-migration-v2.js
```

This script added all necessary columns and indexes to support the campaign module.

## Summary

The Campaign Module is **production-ready** and can handle **thousands of customers simultaneously** with:

- ✅ Scalable BullMQ architecture
- ✅ Rate limiting for WhatsApp API compliance
- ✅ Audience segmentation with advanced filtering
- ✅ WhatsApp template integration (avoids approval delays)
- ✅ Product/image reuse capability
- ✅ Real-time analytics and tracking
- ✅ Automatic retry with exponential backoff
- ✅ Comprehensive error handling

You can now run marketing campaigns to thousands of customers with confidence!
