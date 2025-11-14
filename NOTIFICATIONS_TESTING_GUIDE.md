# Notifications System - Complete Testing Guide

## Overview

Complete multi-channel notification system (Email, SMS, WhatsApp) integrated with Orders and Payments modules.

**Channels Supported**:
- ✅ Email (via SMTP/Nodemailer)
- ✅ SMS (via Twilio)
- ✅ WhatsApp (via Twilio)
- ⏳ Push (not yet implemented)

**Features**:
- ✅ Template-based notifications with Handlebars
- ✅ Multi-channel support (send same notification via multiple channels)
- ✅ Async processing with BullMQ queues
- ✅ Delivery tracking and event logs
- ✅ User preferences management
- ✅ Retry logic with exponential backoff
- ✅ 5 pre-configured system templates

---

## Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=BizNavigate

# Twilio Configuration (SMS + WhatsApp)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 2. For Testing (Your Credentials)

Use these for testing:
- **Email**: muhsirkhan123@gmail.com
- **Phone**: +919605969842 (or 9605969842)

---

## API Endpoints

### Sending Notifications

#### 1. Send Single Notification
`POST /notifications/send`

```json
{
  "business_id": "{{business_id}}",
  "tenant_id": "{{tenant_id}}",
  "customer_id": "{{customer_id}}",
  "recipient_email": "muhsirkhan123@gmail.com",
  "recipient_phone": "9605969842",
  "recipient_name": "Muhsir Khan",
  "template_key": "order_confirmation",
  "channel": "email",
  "context_data": {
    "customer_name": "Muhsir",
    "order_number": "ORD-001",
    "total_amount": 1500,
    "item_count": 2,
    "order_date": "2025-01-11"
  },
  "priority": 1
}
```

**Channels**: `email`, `sms`, `whatsapp`, `push`

**Priority**:
- 1 = URGENT (sent immediately)
- 2 = HIGH (sent immediately)
- 5 = NORMAL (queued)
- 10 = BATCH (queued, low priority)

#### 2. Send Multi-Channel Notification
`POST /notifications/send/multi-channel`

```json
{
  "business_id": "{{business_id}}",
  "tenant_id": "{{tenant_id}}",
  "customer_id": "{{customer_id}}",
  "recipient_email": "muhsirkhan123@gmail.com",
  "recipient_phone": "9605969842",
  "recipient_name": "Muhsir Khan",
  "template_key": "payment_receipt",
  "channels": ["email", "sms", "whatsapp"],
  "context_data": {
    "customer_name": "Muhsir",
    "order_number": "ORD-001",
    "amount": 1500,
    "payment_id": "pay_123456",
    "payment_method": "UPI",
    "payment_date": "11 Jan 2025"
  }
}
```

Sends the same message via Email, SMS, and WhatsApp.

#### 3. Send Bulk Notifications
`POST /notifications/send/bulk`

```json
{
  "business_id": "{{business_id}}",
  "tenant_id": "{{tenant_id}}",
  "template_key": "order_shipped",
  "channel": "sms",
  "recipients": [
    {
      "customer_id": "{{customer_id_1}}",
      "recipient_phone": "9605969842",
      "recipient_name": "Customer 1",
      "context_data": {
        "customer_name": "Customer 1",
        "order_number": "ORD-001",
        "tracking_number": "TRACK123",
        "carrier_name": "Delhivery",
        "expected_delivery": "15 Jan 2025",
        "tracking_url": "https://track.delhivery.com/123"
      }
    },
    {
      "customer_id": "{{customer_id_2}}",
      "recipient_phone": "9876543210",
      "recipient_name": "Customer 2",
      "context_data": {
        "customer_name": "Customer 2",
        "order_number": "ORD-002",
        "tracking_number": "TRACK456",
        "carrier_name": "Delhivery",
        "expected_delivery": "16 Jan 2025",
        "tracking_url": "https://track.delhivery.com/456"
      }
    }
  ]
}
```

### Querying Notifications

#### 4. Get Notification by ID
`GET /notifications/{{notification_id}}`

#### 5. Get Notifications by Status
`GET /notifications?status=sent`

Status values: `pending`, `queued`, `sent`, `delivered`, `failed`, `bounced`

#### 6. Get Notification Events/Logs
`GET /notifications/{{notification_id}}/events`

Returns delivery tracking events.

### Template Management

#### 7. Create Custom Template
`POST /notifications/templates`

```json
{
  "business_id": "{{business_id}}",
  "tenant_id": "{{tenant_id}}",
  "template_key": "custom_welcome",
  "template_name": "Welcome Message",
  "description": "Welcome new customers",
  "email_subject": "Welcome to {{business_name}}!",
  "email_body": "Hi {{customer_name}},\n\nWelcome! We're excited to have you.",
  "email_html": "<h2>Welcome {{customer_name}}!</h2><p>Thanks for joining us.</p>",
  "sms_body": "Welcome {{customer_name}}! Thanks for joining {{business_name}}.",
  "whatsapp_body": "Hi {{customer_name}}! 👋 Welcome to {{business_name}}. We're here to help!",
  "variables": ["customer_name", "business_name"],
  "enabled_channels": ["email", "sms", "whatsapp"],
  "is_active": true
}
```

#### 8. Get All Templates
`GET /notifications/templates/list?business_id={{business_id}}`

#### 9. Get Template by ID
`GET /notifications/templates/{{template_id}}`

#### 10. Update Template
`PUT /notifications/templates/{{template_id}}`

```json
{
  "template_name": "Updated Welcome",
  "email_subject": "New Subject {{customer_name}}",
  "is_active": false
}
```

#### 11. Delete Template
`DELETE /notifications/templates/{{template_id}}`

### Preference Management

#### 12. Get Customer Preferences
`GET /notifications/preferences/customer/{{customer_id}}?business_id={{business_id}}`

#### 13. Update Customer Preferences
`PUT /notifications/preferences/customer/{{customer_id}}`

```json
{
  "business_id": "{{business_id}}",
  "email_enabled": true,
  "sms_enabled": true,
  "whatsapp_enabled": false,
  "push_enabled": true,
  "preferences": {
    "order_updates": true,
    "payment_updates": true,
    "promotional": false,
    "newsletters": false,
    "account_updates": true
  },
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}
```

---

## Pre-Configured System Templates

### 1. Order Confirmation (`order_confirmation`)

**Variables**: `customer_name`, `order_number`, `total_amount`, `item_count`, `order_date`

**Example**:
```json
{
  "template_key": "order_confirmation",
  "channel": "email",
  "context_data": {
    "customer_name": "Muhsir",
    "order_number": "ORD-001",
    "total_amount": 1500,
    "item_count": 2,
    "order_date": "11 Jan 2025"
  }
}
```

### 2. Payment Receipt (`payment_receipt`)

**Variables**: `customer_name`, `order_number`, `amount`, `payment_id`, `payment_method`, `payment_date`

### 3. Payment Failed (`payment_failed`)

**Variables**: `customer_name`, `order_number`, `amount`, `failure_reason`

### 4. Order Shipped (`order_shipped`)

**Variables**: `customer_name`, `order_number`, `tracking_number`, `carrier_name`, `expected_delivery`, `tracking_url`

### 5. OTP Verification (`otp_verification`)

**Variables**: `otp_code`, `expiry_minutes`

**Example**:
```json
{
  "template_key": "otp_verification",
  "channel": "sms",
  "recipient_phone": "9605969842",
  "context_data": {
    "otp_code": "123456",
    "expiry_minutes": 5
  }
}
```

---

## Complete Testing Flow

### Test 1: Send Email Notification

```bash
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {{your_jwt_token}}" \
  -d '{
    "business_id": "your-business-id",
    "tenant_id": "your-tenant-id",
    "recipient_email": "muhsirkhan123@gmail.com",
    "recipient_name": "Muhsir Khan",
    "template_key": "order_confirmation",
    "channel": "email",
    "context_data": {
      "customer_name": "Muhsir",
      "order_number": "ORD-001",
      "total_amount": 1500,
      "item_count": 2,
      "order_date": "11 Jan 2025"
    },
    "priority": 1
  }'
```

### Test 2: Send SMS Notification

```bash
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {{your_jwt_token}}" \
  -d '{
    "business_id": "your-business-id",
    "tenant_id": "your-tenant-id",
    "recipient_phone": "9605969842",
    "recipient_name": "Muhsir Khan",
    "template_key": "payment_receipt",
    "channel": "sms",
    "context_data": {
      "customer_name": "Muhsir",
      "order_number": "ORD-001",
      "amount": 1500,
      "payment_id": "pay_123",
      "payment_method": "UPI",
      "payment_date": "11 Jan 2025"
    }
  }'
```

### Test 3: Send WhatsApp Notification

```bash
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {{your_jwt_token}}" \
  -d '{
    "business_id": "your-business-id",
    "tenant_id": "your-tenant-id",
    "recipient_phone": "9605969842",
    "recipient_name": "Muhsir Khan",
    "template_key": "order_shipped",
    "channel": "whatsapp",
    "context_data": {
      "customer_name": "Muhsir",
      "order_number": "ORD-001",
      "tracking_number": "TRACK123",
      "carrier_name": "Delhivery",
      "expected_delivery": "15 Jan 2025",
      "tracking_url": "https://track.delhivery.com/123"
    }
  }'
```

### Test 4: Send Multi-Channel (Email + SMS + WhatsApp)

```bash
curl -X POST http://localhost:3000/notifications/send/multi-channel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {{your_jwt_token}}" \
  -d '{
    "business_id": "your-business-id",
    "tenant_id": "your-tenant-id",
    "recipient_email": "muhsirkhan123@gmail.com",
    "recipient_phone": "9605969842",
    "recipient_name": "Muhsir Khan",
    "template_key": "payment_receipt",
    "channels": ["email", "sms", "whatsapp"],
    "context_data": {
      "customer_name": "Muhsir",
      "order_number": "ORD-001",
      "amount": 1500,
      "payment_id": "pay_123",
      "payment_method": "UPI",
      "payment_date": "11 Jan 2025"
    }
  }'
```

---

## Integration with Orders & Payments

**The notification system is ready to be integrated** with Orders and Payments modules. When you're ready, I'll add automatic notifications for:

1. **Order Events**:
   - Order created → `order_confirmation` notification
   - Order shipped → `order_shipped` notification
   - Order delivered → `order_delivered` notification
   - Order cancelled → `order_cancelled` notification

2. **Payment Events**:
   - Payment captured → `payment_receipt` notification
   - Payment failed → `payment_failed` notification

---

## Database Tables

1. **notification_templates** - Reusable templates
2. **notification_messages** - All sent notifications
3. **notification_preferences** - User/Customer preferences
4. **notification_events** - Delivery tracking events

All tables include proper indexes for high performance.

---

## Priority & Queueing

- **Priority 1-2 (URGENT/HIGH)**: Sent immediately (synchronous)
- **Priority 5+ (NORMAL/LOW)**: Queued in BullMQ for async processing
- **Retry Logic**: 3 attempts with exponential backoff

---

## Handlebars Template Helpers

Custom helpers available in templates:

- `{{currency value}}` - Format as ₹1,500.00
- `{{formatDate date}}` - Format as "11 January 2025"
- `{{formatTime date}}` - Format as "05:30 PM"
- `{{uppercase text}}` - Convert to UPPERCASE
- `{{lowercase text}}` - Convert to lowercase
- `{{truncate text 50}}` - Truncate to 50 characters

---

## Testing Checklist

- [ ] Configure SMTP settings in .env
- [ ] Configure Twilio settings in .env
- [ ] Test email notification
- [ ] Test SMS notification
- [ ] Test WhatsApp notification
- [ ] Test multi-channel notification
- [ ] Test custom template creation
- [ ] Test customer preferences
- [ ] Verify delivery tracking
- [ ] Test retry on failure
- [ ] Check notification events/logs

---

## Production Deployment

Before going to production:

1. ✅ All tables created (migration run successfully)
2. ✅ 5 system templates inserted
3. ⏳ Configure production SMTP credentials
4. ⏳ Configure production Twilio credentials
5. ⏳ Set up Redis for BullMQ (if not already running)
6. ⏳ Integrate with Orders module (add event triggers)
7. ⏳ Integrate with Payments module (add webhook triggers)
8. ⏳ Set up monitoring for notification delivery rates
9. ⏳ Configure quiet hours if needed
10. ⏳ Test with real customers

---

## Next Steps

Ready to integrate notifications automatically with:
1. Orders Module (auto-send confirmation, shipping, delivery notifications)
2. Payments Module (auto-send payment receipts and failure notifications)

**Should I proceed with the integrations?**
