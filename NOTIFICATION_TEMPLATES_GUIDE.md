# Notification Templates Module Guide

## Overview

The Notification Templates Module is a production-ready multi-channel notification template management system that enables businesses to create, manage, and deploy notification templates across Email, SMS, WhatsApp, and Push notification channels.

## Key Features

- **Multi-Channel Support**: Email, SMS, WhatsApp, and Push notifications
- **Dynamic Variables**: Type-validated placeholder system with {{variableName}} syntax
- **Template Validation**: Comprehensive validation of content, variables, and channel configuration
- **Preview & Testing**: Preview templates with sample data and send test notifications
- **Template Versioning**: Clone templates for A/B testing and version management
- **Bulk Operations**: Activate, deactivate, or delete multiple templates at once
- **Campaign Integration**: Track template usage across campaigns
- **System Protection**: System templates cannot be modified or deleted
- **Performance Metrics**: Track delivery, click, and conversion rates
- **Export/Import**: JSON-based template backup and migration

## Architecture

### Module Structure

```
src/features/notification-templates/
├── application/
│   ├── dto/
│   │   └── template.dto.ts          # DTOs with validation (560+ lines)
│   └── services/
│       ├── template-validation.service.ts  # Validation logic (329 lines)
│       ├── template.service.ts             # Core CRUD operations (589 lines)
│       └── template-preview.service.ts     # Rendering & preview (398 lines)
├── controllers/
│   └── templates.controller.ts       # REST API endpoints (720+ lines)
└── templates.module.ts               # Module registration
```

### Service Responsibilities

**TemplateService** [template.service.ts:589](src/features/notification-templates/application/services/template.service.ts)
- Create, read, update, delete templates
- Template cloning and bulk operations
- Campaign usage tracking
- Performance statistics

**TemplateValidationService** [template-validation.service.ts:329](src/features/notification-templates/application/services/template-validation.service.ts)
- Variable extraction and validation
- Content validation across channels
- Type checking for variable values
- HTML sanitization for XSS prevention
- SMS length estimation

**TemplatePreviewService** [template-preview.service.ts:398](src/features/notification-templates/application/services/template-preview.service.ts)
- Template rendering with variables
- Test notification sending
- Batch preview generation
- Template comparison for A/B testing
- Export functionality

## Database Schema

The module uses the existing `notification_templates` table:

```sql
CREATE TABLE notification_templates (
  template_id           UUID PRIMARY KEY,
  business_id           UUID NOT NULL,
  tenant_id             UUID NOT NULL,
  template_key          VARCHAR(100) UNIQUE,
  template_name         VARCHAR(255),
  description           TEXT,

  -- Email Channel
  email_subject         VARCHAR(500),
  email_body            TEXT,
  email_html            TEXT,

  -- SMS Channel
  sms_body              VARCHAR(1600),

  -- WhatsApp Channel
  whatsapp_body         TEXT,

  -- Push Channel
  push_title            VARCHAR(255),
  push_body             TEXT,

  -- Configuration
  variables             JSONB,           -- Variable definitions
  enabled_channels      JSONB,           -- Array of enabled channels
  is_active             BOOLEAN,
  is_system             BOOLEAN,         -- System templates cannot be deleted

  -- Metadata
  created_by            UUID,
  created_at            TIMESTAMP,
  updated_at            TIMESTAMP,
  deleted_at            TIMESTAMP
);
```

## API Endpoints

### Base URL
```
http://localhost:8000/notification-templates
```

### Swagger Documentation
```
http://localhost:8000/api/docs#/Notification%20Templates
```

---

## API Reference

### 1. Create Template

**POST** `/notification-templates`

Create a new multi-channel notification template.

**Request Body**:
```json
{
  "businessId": "business-uuid-here",
  "tenantId": "tenant-uuid-here",
  "templateKey": "order_confirmation",
  "templateName": "Order Confirmation",
  "description": "Sent when customer places an order",

  "emailSubject": "Your Order #{{orderNumber}} has been confirmed!",
  "emailBody": "Hi {{customerName}}, thank you for your order!",
  "emailHtml": "<h1>Thank you {{customerName}}!</h1><p>Your order #{{orderNumber}} is confirmed.</p>",

  "smsBody": "Hi {{customerName}}! Your order #{{orderNumber}} is confirmed. Track: {{trackingUrl}}",

  "whatsappBody": "Hello {{customerName}}! 🎉 Your order #{{orderNumber}} has been confirmed.",

  "pushTitle": "Order Confirmed!",
  "pushBody": "Your order #{{orderNumber}} is on its way!",

  "variables": [
    {
      "key": "customerName",
      "label": "Customer Name",
      "type": "text",
      "description": "The full name of the customer",
      "required": true,
      "exampleValue": "John Doe"
    },
    {
      "key": "orderNumber",
      "label": "Order Number",
      "type": "text",
      "required": true,
      "exampleValue": "ORD-12345"
    },
    {
      "key": "trackingUrl",
      "label": "Tracking URL",
      "type": "url",
      "required": false,
      "exampleValue": "https://example.com/track/12345"
    }
  ],

  "enabledChannels": ["email", "sms", "whatsapp", "push"],
  "isActive": true,
  "createdBy": "user-uuid-here"
}
```

**Response** (201 Created):
```json
{
  "templateId": "template-uuid-generated",
  "templateKey": "order_confirmation",
  "templateName": "Order Confirmation",
  "businessId": "business-uuid-here",
  "enabledChannels": ["email", "sms", "whatsapp", "push"],
  "isActive": true,
  "createdAt": "2024-11-03T12:00:00Z",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}
```

**Error Responses**:
- 400: Invalid template data or validation errors
- 409: Template key already exists for this business

---

### 2. List Templates

**GET** `/notification-templates?businessId={uuid}&page=1&limit=20`

Retrieve paginated list of templates with filtering.

**Query Parameters**:
- `businessId` (optional): Filter by business UUID
- `tenantId` (optional): Filter by tenant UUID
- `templateKey` (optional): Filter by template key
- `channel` (optional): Filter by channel (email, sms, whatsapp, push)
- `isActive` (optional): Filter by active status (true/false)
- `isSystem` (optional): Filter by system template status
- `search` (optional): Search across name, key, and description
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response** (200 OK):
```json
{
  "templates": [
    {
      "templateId": "template-uuid-1",
      "templateKey": "order_confirmation",
      "templateName": "Order Confirmation",
      "enabledChannels": ["email", "whatsapp"],
      "isActive": true,
      "isSystem": false,
      "createdAt": "2024-11-03T12:00:00Z"
    },
    {
      "templateId": "template-uuid-2",
      "templateKey": "password_reset",
      "templateName": "Password Reset",
      "enabledChannels": ["email", "sms"],
      "isActive": true,
      "isSystem": true,
      "createdAt": "2024-11-02T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 3. Get Template by ID

**GET** `/notification-templates/:id`

Retrieve complete template details.

**Response** (200 OK):
```json
{
  "templateId": "template-uuid",
  "businessId": "business-uuid",
  "tenantId": "tenant-uuid",
  "templateKey": "order_confirmation",
  "templateName": "Order Confirmation",
  "description": "Sent when customer places an order",
  "emailSubject": "Your Order #{{orderNumber}} has been confirmed!",
  "emailBody": "Hi {{customerName}}, thank you for your order!",
  "emailHtml": "<h1>Thank you {{customerName}}!</h1>",
  "smsBody": "Hi {{customerName}}! Your order #{{orderNumber}} is confirmed.",
  "whatsappBody": "Hello {{customerName}}! Your order is confirmed.",
  "pushTitle": "Order Confirmed",
  "pushBody": "Your order #{{orderNumber}} is confirmed!",
  "variables": [
    {
      "key": "customerName",
      "label": "Customer Name",
      "type": "text",
      "required": true,
      "exampleValue": "John Doe"
    },
    {
      "key": "orderNumber",
      "label": "Order Number",
      "type": "text",
      "required": true,
      "exampleValue": "ORD-12345"
    }
  ],
  "enabledChannels": ["email", "sms", "whatsapp", "push"],
  "isActive": true,
  "isSystem": false,
  "createdAt": "2024-11-03T12:00:00Z",
  "updatedAt": "2024-11-03T12:00:00Z"
}
```

---

### 4. Get Template by Business and Key

**GET** `/notification-templates/by-key/:businessId/:key`

Retrieve template using business ID and template key.

**Example**: `/notification-templates/by-key/biz-uuid/order_confirmation`

---

### 5. Update Template

**PUT** `/notification-templates/:id`

Update an existing template. System templates cannot be modified.

**Request Body** (all fields optional):
```json
{
  "templateName": "Order Confirmation V2",
  "description": "Updated description",
  "emailSubject": "New subject line",
  "variables": [
    {
      "key": "customerName",
      "label": "Customer Name",
      "type": "text",
      "required": true
    }
  ],
  "enabledChannels": ["email", "whatsapp"],
  "isActive": false
}
```

**Response** (200 OK):
```json
{
  "templateId": "template-uuid",
  "templateName": "Order Confirmation V2",
  "updatedAt": "2024-11-03T14:30:00Z",
  "validation": {
    "isValid": true,
    "warnings": []
  }
}
```

**Error Responses**:
- 400: Invalid template data
- 403: Cannot modify system template
- 404: Template not found

---

### 6. Delete Template

**DELETE** `/notification-templates/:id`

Delete a template. System templates and templates used in active campaigns cannot be deleted.

**Response**: 204 No Content

**Error Responses**:
- 403: Cannot delete system template or template in use
- 404: Template not found

---

### 7. Clone Template

**POST** `/notification-templates/clone`

Create a copy of an existing template with a new key and name.

**Request Body**:
```json
{
  "sourceTemplateId": "original-template-uuid",
  "newTemplateKey": "order_confirmation_v2",
  "newTemplateName": "Order Confirmation V2",
  "copyAsActive": false
}
```

**Response** (201 Created):
```json
{
  "templateId": "new-template-uuid",
  "templateKey": "order_confirmation_v2",
  "templateName": "Order Confirmation V2",
  "sourceTemplateId": "original-template-uuid",
  "isActive": false,
  "createdAt": "2024-11-03T12:00:00Z"
}
```

---

### 8. Bulk Actions

**POST** `/notification-templates/bulk`

Perform bulk actions on multiple templates.

**Request Body**:
```json
{
  "templateIds": [
    "template-uuid-1",
    "template-uuid-2",
    "template-uuid-3"
  ],
  "action": "activate"
}
```

**Actions**: `activate`, `deactivate`, `delete`

**Response** (200 OK):
```json
{
  "action": "activate",
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "templateId": "template-uuid-1",
      "success": true
    },
    {
      "templateId": "template-uuid-2",
      "success": true
    },
    {
      "templateId": "template-uuid-3",
      "success": true
    }
  ]
}
```

---

### 9. Validate Template

**GET** `/notification-templates/:id/validate`

Check template for errors, warnings, and variable consistency.

**Response** (200 OK):
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    "Variable {{discount}} is defined but not used in any channel"
  ],
  "detectedVariables": ["customerName", "orderNumber"],
  "missingDefinitions": []
}
```

---

### 10. Get Template Statistics

**GET** `/notification-templates/:id/stats`

Get usage statistics and performance metrics.

**Response** (200 OK):
```json
{
  "templateId": "template-uuid",
  "templateName": "Order Confirmation",
  "campaignUsageCount": 12,
  "totalSent": 15234,
  "totalDelivered": 15102,
  "totalFailed": 132,
  "totalClicked": 3421,
  "totalConverted": 892,
  "deliveryRate": 99.13,
  "clickRate": 22.65,
  "conversionRate": 5.90,
  "lastUsed": "2024-11-02T15:30:00Z"
}
```

---

### 11. Get Active Templates for Business

**GET** `/notification-templates/business/:businessId/active?channel=email`

Get all active templates for a business, optionally filtered by channel.

**Response** (200 OK):
```json
[
  {
    "templateId": "template-uuid-1",
    "templateKey": "order_confirmation",
    "templateName": "Order Confirmation",
    "enabledChannels": ["email", "whatsapp"]
  },
  {
    "templateId": "template-uuid-2",
    "templateKey": "password_reset",
    "templateName": "Password Reset",
    "enabledChannels": ["email", "sms"]
  }
]
```

---

### 12. Preview Template

**POST** `/notification-templates/preview`

Generate a preview with provided variables.

**Request Body**:
```json
{
  "templateId": "template-uuid",
  "channel": "whatsapp",
  "variables": {
    "customerName": "John Doe",
    "orderNumber": "ORD-12345",
    "trackingUrl": "https://example.com/track/12345"
  }
}
```

**Response** (200 OK):
```json
{
  "channel": "whatsapp",
  "templateId": "template-uuid",
  "templateName": "Order Confirmation",
  "body": "Hello John Doe! 🎉 Your order #ORD-12345 has been confirmed.",
  "variables": {
    "customerName": "John Doe",
    "orderNumber": "ORD-12345",
    "trackingUrl": "https://example.com/track/12345"
  },
  "detectedVariables": ["customerName", "orderNumber"]
}
```

**For Email Channel**:
```json
{
  "channel": "email",
  "subject": "Your Order #ORD-12345 has been confirmed!",
  "body": "Hi John Doe, thank you for your order!",
  "html": "<h1>Thank you John Doe!</h1><p>Your order is confirmed.</p>"
}
```

**For SMS Channel**:
```json
{
  "channel": "sms",
  "body": "Hi John Doe! Your order #ORD-12345 is confirmed.",
  "length": 52,
  "segments": 1
}
```

---

### 13. Get Sample Preview

**GET** `/notification-templates/:id/sample-preview/:channel`

Preview template using example values from variable definitions.

**Example**: `/notification-templates/template-uuid/sample-preview/email`

---

### 14. Send Test Notification

**POST** `/notification-templates/test`

Send a test notification to verify rendering and delivery.

**Request Body**:
```json
{
  "templateId": "template-uuid",
  "channel": "whatsapp",
  "variables": {
    "customerName": "Test User",
    "orderNumber": "TEST-001"
  },
  "testPhone": "+919876543210"
}
```

**For Different Channels**:
- Email: Provide `testEmail`
- SMS/WhatsApp: Provide `testPhone`
- Push: Provide `testDeviceToken`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Test notification queued for whatsapp",
  "recipient": "+919876543210",
  "preview": {
    "channel": "whatsapp",
    "body": "Hello Test User! Your order #TEST-001 has been confirmed."
  }
}
```

---

### 15. Batch Preview

**POST** `/notification-templates/:id/batch-preview`

Preview template with multiple variable sets.

**Request Body**:
```json
{
  "channel": "email",
  "variableSets": [
    {
      "customerName": "Alice",
      "orderNumber": "ORD-001"
    },
    {
      "customerName": "Bob",
      "orderNumber": "ORD-002"
    },
    {
      "customerName": "Charlie",
      "orderNumber": "ORD-003"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "previews": [
    {
      "success": true,
      "preview": {
        "channel": "email",
        "subject": "Order #ORD-001 confirmed",
        "body": "Hi Alice..."
      }
    },
    {
      "success": true,
      "preview": {
        "channel": "email",
        "subject": "Order #ORD-002 confirmed",
        "body": "Hi Bob..."
      }
    },
    {
      "success": true,
      "preview": {
        "channel": "email",
        "subject": "Order #ORD-003 confirmed",
        "body": "Hi Charlie..."
      }
    }
  ]
}
```

---

### 16. Compare Templates

**POST** `/notification-templates/compare`

Compare two templates side-by-side for A/B testing.

**Request Body**:
```json
{
  "templateId1": "template-uuid-a",
  "templateId2": "template-uuid-b",
  "channel": "email",
  "variables": {
    "customerName": "John Doe",
    "orderNumber": "ORD-12345"
  }
}
```

**Response** (200 OK):
```json
{
  "template1": {
    "channel": "email",
    "subject": "Order Confirmed - Version A",
    "body": "Hi John, your order is confirmed!"
  },
  "template2": {
    "channel": "email",
    "subject": "Order Confirmed - Version B",
    "body": "Hello John! Your order has been confirmed."
  },
  "comparison": {
    "channel": "email",
    "differences": {
      "subject": {
        "template1": "Order Confirmed - Version A",
        "template2": "Order Confirmed - Version B"
      },
      "body": {
        "template1": "Hi John, your order is confirmed!",
        "template2": "Hello John! Your order has been confirmed.",
        "lengthDiff": 10
      }
    }
  }
}
```

---

### 17. Export Template

**GET** `/notification-templates/:id/export`

Export template as JSON for backup or migration.

**Response** (200 OK):
```json
{
  "version": "1.0",
  "exportedAt": "2024-11-03T12:00:00Z",
  "template": {
    "templateKey": "order_confirmation",
    "templateName": "Order Confirmation",
    "description": "Sent when customer places an order",
    "emailSubject": "Your Order #{{orderNumber}} confirmed!",
    "emailBody": "Hi {{customerName}}...",
    "emailHtml": "<h1>Thank you {{customerName}}!</h1>",
    "smsBody": "Order #{{orderNumber}} confirmed",
    "whatsappBody": "Hello {{customerName}}!",
    "pushTitle": "Order Confirmed",
    "pushBody": "Your order is ready!",
    "variables": [...],
    "enabledChannels": ["email", "sms", "whatsapp", "push"]
  }
}
```

---

## Variable System

### Supported Variable Types

1. **TEXT**: Any string value
2. **NUMBER**: Numeric values
3. **DATE**: ISO date strings
4. **URL**: Valid URLs
5. **EMAIL**: Email addresses
6. **PHONE**: Phone numbers

### Variable Syntax

Variables use double curly braces: `{{variableName}}`

**Template Content**:
```
Hello {{customerName}}!

Your order #{{orderNumber}} has been confirmed.
Total: ${{orderTotal}}
Delivery Date: {{deliveryDate}}
```

**Variable Replacement**:
```json
{
  "customerName": "John Doe",
  "orderNumber": "ORD-12345",
  "orderTotal": 99.99,
  "deliveryDate": "2024-11-10"
}
```

**Result**:
```
Hello John Doe!

Your order #ORD-12345 has been confirmed.
Total: $99.99
Delivery Date: 2024-11-10
```

### Variable Validation

The system validates:
- Required variables are provided
- Variable types match definitions
- Email format for email variables
- Phone format for phone variables
- Valid URLs for url variables
- No malformed variables (`{` without `{{`)
- No nested variables (not supported)

---

## Channel-Specific Guidelines

### Email Templates

**Best Practices**:
- Subject line: 50-60 characters
- Preview text (first line of body): 90-110 characters
- Mobile-optimized HTML
- Plain text fallback

**Example**:
```json
{
  "emailSubject": "{{customerName}}, your order #{{orderNumber}} is confirmed! 🎉",
  "emailBody": "Hi {{customerName}},\n\nThank you for your order!",
  "emailHtml": "<html><body><h1>Thank you {{customerName}}!</h1>...</body></html>"
}
```

### SMS Templates

**Constraints**:
- Max 1600 characters
- Single segment: 160 characters
- Multi-segment: 153 characters per segment
- Avoid special characters to save space

**Character Count**:
- System automatically calculates segments
- Preview shows length and segment count

**Example**:
```json
{
  "smsBody": "Hi {{customerName}}! Order #{{orderNumber}} confirmed. Track: {{trackingUrl}}"
}
```

### WhatsApp Templates

**Features**:
- Supports emojis
- Supports line breaks
- Rich formatting

**Example**:
```json
{
  "whatsappBody": "Hello {{customerName}}! 🎉\n\nYour order #{{orderNumber}} has been confirmed.\n\nTrack your order: {{trackingUrl}}"
}
```

### Push Notifications

**Constraints**:
- Title: max 255 characters
- Body: max 500 characters (varies by platform)
- Keep concise for better engagement

**Example**:
```json
{
  "pushTitle": "Order Confirmed!",
  "pushBody": "{{customerName}}, your order #{{orderNumber}} is on its way!"
}
```

---

## Complete Workflow Example

### Scenario: Create and Test Order Confirmation Template

**Step 1**: Create Template
```bash
curl -X POST http://localhost:8000/notification-templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "businessId": "biz-123",
    "tenantId": "tenant-123",
    "templateKey": "order_confirmation",
    "templateName": "Order Confirmation",
    "emailSubject": "Order #{{orderNumber}} Confirmed!",
    "emailBody": "Hi {{customerName}}, your order is confirmed.",
    "smsBody": "Hi {{customerName}}! Order #{{orderNumber}} confirmed.",
    "whatsappBody": "Hello {{customerName}}! 🎉 Order #{{orderNumber}} confirmed.",
    "pushTitle": "Order Confirmed",
    "pushBody": "Your order #{{orderNumber}} is ready!",
    "variables": [
      {
        "key": "customerName",
        "label": "Customer Name",
        "type": "text",
        "required": true,
        "exampleValue": "John Doe"
      },
      {
        "key": "orderNumber",
        "label": "Order Number",
        "type": "text",
        "required": true,
        "exampleValue": "ORD-12345"
      }
    ],
    "enabledChannels": ["email", "sms", "whatsapp", "push"],
    "isActive": true,
    "createdBy": "user-123"
  }'
```

**Step 2**: Validate Template
```bash
curl -X GET http://localhost:8000/notification-templates/template-uuid/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Step 3**: Preview Template
```bash
curl -X POST http://localhost:8000/notification-templates/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "templateId": "template-uuid",
    "channel": "whatsapp",
    "variables": {
      "customerName": "Alice Johnson",
      "orderNumber": "ORD-67890"
    }
  }'
```

**Step 4**: Send Test Notification
```bash
curl -X POST http://localhost:8000/notification-templates/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "templateId": "template-uuid",
    "channel": "whatsapp",
    "variables": {
      "customerName": "Test User",
      "orderNumber": "TEST-001"
    },
    "testPhone": "+919876543210"
  }'
```

**Step 5**: Use in Campaign

Once tested, use the template in campaigns:
```bash
curl -X POST http://localhost:8000/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "businessId": "biz-123",
    "campaignName": "Black Friday Sale",
    "templateId": "template-uuid",
    "channel": "whatsapp",
    "audienceType": "customers",
    "audienceFilter": {
      "totalSpent": { "gte": 1000 }
    }
  }'
```

---

## Integration with Campaigns Module

The Notification Templates Module integrates seamlessly with the Campaigns Module:

1. **Template Selection**: Campaigns reference templates by `templateId`
2. **Variable Injection**: Campaign variables override template variables
3. **Usage Tracking**: Template stats track campaign performance
4. **Deletion Protection**: Templates used in active campaigns cannot be deleted

**Example Campaign with Template**:
```json
{
  "campaignId": "campaign-uuid",
  "templateId": "template-uuid",
  "variables": {
    "customerName": "{{customer.name}}",
    "orderNumber": "{{order.number}}"
  }
}
```

---

## Best Practices

### 1. Template Naming

- Use snake_case for template keys: `order_confirmation`
- Use descriptive names: "Order Confirmation" instead of "Template 1"
- Include version in key for A/B testing: `order_confirmation_v2`

### 2. Variable Design

- Keep variable names semantic: `customerName` not `var1`
- Use camelCase for variable keys
- Provide example values for testing
- Set appropriate default values

### 3. Content Guidelines

- Personalize with customer name
- Keep subject lines short and action-oriented
- Include clear call-to-action
- Test across all enabled channels
- Use emojis sparingly (mainly WhatsApp)

### 4. Testing Strategy

- Always preview before deploying
- Send test notifications to real devices
- Use batch preview for variable validation
- Compare templates for A/B testing
- Monitor performance metrics

### 5. Performance Optimization

- Clone successful templates for new campaigns
- Deactivate unused templates
- Archive old templates instead of deleting
- Monitor delivery and conversion rates
- A/B test subject lines and content

---

## Error Handling

### Common Errors

**Template Key Conflict** (409):
```json
{
  "statusCode": 409,
  "message": "Template with key 'order_confirmation' already exists for this business"
}
```

**Invalid Variables** (400):
```json
{
  "statusCode": 400,
  "message": "Invalid variables provided",
  "errors": [
    "Variable 'customerName' is required but not provided",
    "Variable 'email' must be a valid email address"
  ]
}
```

**System Template Modification** (403):
```json
{
  "statusCode": 403,
  "message": "Cannot modify system template"
}
```

**Template In Use** (403):
```json
{
  "statusCode": 403,
  "message": "Cannot delete template. Currently used in 3 active campaigns."
}
```

---

## Security Features

### XSS Prevention

HTML email templates are sanitized to prevent XSS attacks:
- `<script>` tags removed
- Event handlers (`onclick`, `onerror`, etc.) removed
- `javascript:` protocols removed

### Variable Injection Protection

- Variables are validated against defined types
- HTML entities escaped in text content
- URL validation for url-type variables
- Email format validation

---

## Performance Metrics

The module tracks:
- **Campaign Usage**: Number of campaigns using the template
- **Total Sent**: Total messages sent using this template
- **Total Delivered**: Successfully delivered messages
- **Total Failed**: Failed deliveries
- **Total Clicked**: Link clicks (if tracking enabled)
- **Total Converted**: Conversions (if tracking enabled)
- **Delivery Rate**: (delivered / sent) * 100
- **Click Rate**: (clicked / delivered) * 100
- **Conversion Rate**: (converted / delivered) * 100

---

## Summary

The Notification Templates Module is **production-ready** and provides:

- ✅ Multi-channel notification support (Email, SMS, WhatsApp, Push)
- ✅ Dynamic variable system with type validation
- ✅ Comprehensive template validation
- ✅ Preview and testing capabilities
- ✅ Template cloning for versioning
- ✅ Bulk operations for efficiency
- ✅ Campaign integration and usage tracking
- ✅ Performance metrics and analytics
- ✅ System template protection
- ✅ XSS prevention and security
- ✅ Export/import functionality
- ✅ Complete Swagger documentation
- ✅ Production-grade error handling

**API Base URL**: `http://localhost:8000/notification-templates`
**Swagger Docs**: `http://localhost:8000/api/docs#/Notification%20Templates`

You can now create, manage, and deploy notification templates across multiple channels with confidence!
