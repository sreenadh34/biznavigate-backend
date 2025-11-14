-- ================================================
-- NOTIFICATIONS SYSTEM MIGRATION
-- ================================================
-- Purpose: Multi-channel notification system (Email, SMS, WhatsApp, Push)
-- Features: Template management, delivery tracking, retry logic, user preferences
-- Created: 2025-01-02
-- ================================================

-- ================================================
-- 1. NOTIFICATION TEMPLATES TABLE
-- ================================================
-- Stores reusable notification templates with variable substitution
CREATE TABLE IF NOT EXISTS notification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  tenant_id UUID,

  -- Template identification
  template_key VARCHAR(100) NOT NULL, -- e.g., 'order_confirmation', 'payment_receipt'
  template_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Channel-specific content
  email_subject VARCHAR(500),
  email_body TEXT,
  email_html TEXT,
  sms_body VARCHAR(1600), -- SMS character limit
  whatsapp_body TEXT,
  push_title VARCHAR(255),
  push_body TEXT,

  -- Template variables (JSON array of variable names)
  variables JSONB DEFAULT '[]'::jsonb, -- e.g., ["customer_name", "order_id", "amount"]

  -- Channel enablement
  enabled_channels JSONB DEFAULT '["email", "sms", "whatsapp", "push"]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  -- Foreign keys
  CONSTRAINT fk_notification_template_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_template_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT unique_template_key_per_business UNIQUE(business_id, template_key)
);

-- ================================================
-- 2. NOTIFICATION_MESSAGES TABLE
-- ================================================
-- Stores all notification records and delivery status
CREATE TABLE IF NOT EXISTS notification_messages (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Recipient information
  customer_id UUID,
  user_id UUID,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(255),

  -- Template & channel
  template_id UUID,
  template_key VARCHAR(100),
  channel VARCHAR(50) NOT NULL, -- 'email', 'sms', 'whatsapp', 'push'

  -- Content (final rendered content)
  subject VARCHAR(500),
  body TEXT,
  html_body TEXT,

  -- Context data (variables used for template rendering)
  context_data JSONB DEFAULT '{}'::jsonb,

  -- Related entities
  related_entity_type VARCHAR(100), -- 'order', 'payment', 'customer', etc.
  related_entity_id UUID,

  -- Delivery tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, queued, sent, delivered, failed, bounced
  priority INT DEFAULT 5, -- 1-10, lower is higher priority

  -- Provider details
  provider VARCHAR(50), -- 'nodemailer', 'twilio', 'firebase', etc.
  provider_message_id VARCHAR(500),
  provider_response JSONB,

  -- Timing
  scheduled_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Retry logic
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_retry_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  error_code VARCHAR(100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_notification_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_template FOREIGN KEY (template_id)
    REFERENCES notification_templates(template_id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT chk_notification_channel CHECK (channel IN ('email', 'sms', 'whatsapp', 'push')),
  CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'cancelled')),
  CONSTRAINT chk_notification_priority CHECK (priority BETWEEN 1 AND 10)
);

-- ================================================
-- 3. NOTIFICATION PREFERENCES TABLE
-- ================================================
-- User/Customer notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (customer or user)
  customer_id UUID,
  user_id UUID,
  business_id UUID,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,

  -- Notification type preferences (JSONB for flexibility)
  preferences JSONB DEFAULT '{
    "order_updates": true,
    "payment_updates": true,
    "promotional": false,
    "newsletters": false,
    "account_updates": true
  }'::jsonb,

  -- Quiet hours (JSON for time ranges)
  quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb,

  -- Preferred channels per notification type
  channel_preferences JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_notification_pref_customer FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_pref_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT chk_notification_pref_owner CHECK (
    (customer_id IS NOT NULL AND user_id IS NULL) OR
    (customer_id IS NULL AND user_id IS NOT NULL)
  ),
  CONSTRAINT unique_customer_business_pref UNIQUE(customer_id, business_id),
  CONSTRAINT unique_user_business_pref UNIQUE(user_id, business_id)
);

-- ================================================
-- 4. NOTIFICATION EVENTS TABLE
-- ================================================
-- Event log for notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
  event_data JSONB,

  -- Provider details
  provider_event_id VARCHAR(255),
  provider_timestamp TIMESTAMPTZ,

  -- Metadata
  occurred_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_notification_event_notification FOREIGN KEY (notification_id)
    REFERENCES notification_messages(notification_id) ON DELETE CASCADE
);

-- ================================================
-- 5. INDEXES FOR PERFORMANCE
-- ================================================

-- Notification Templates
CREATE INDEX idx_notification_templates_business_id ON notification_templates(business_id);
CREATE INDEX idx_notification_templates_tenant_id ON notification_templates(tenant_id);
CREATE INDEX idx_notification_templates_template_key ON notification_templates(template_key);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- Notification Messages
CREATE INDEX idx_notification_messages_business_id ON notification_messages(business_id);
CREATE INDEX idx_notification_messages_tenant_id ON notification_messages(tenant_id);
CREATE INDEX idx_notification_messages_customer_id ON notification_messages(customer_id);
CREATE INDEX idx_notification_messages_status ON notification_messages(status);
CREATE INDEX idx_notification_messages_channel ON notification_messages(channel);
CREATE INDEX idx_notification_messages_template_id ON notification_messages(template_id);
CREATE INDEX idx_notification_messages_related_entity ON notification_messages(related_entity_type, related_entity_id);
CREATE INDEX idx_notification_messages_scheduled_at ON notification_messages(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_notification_messages_created_at ON notification_messages(created_at DESC);
CREATE INDEX idx_notification_messages_pending ON notification_messages(status) WHERE status IN ('pending', 'queued');

-- Notification Preferences
CREATE INDEX idx_notification_prefs_customer_id ON notification_preferences(customer_id);
CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_prefs_business_id ON notification_preferences(business_id);

-- Notification Events
CREATE INDEX idx_notification_events_notification_id ON notification_events(notification_id);
CREATE INDEX idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX idx_notification_events_occurred_at ON notification_events(occurred_at DESC);

-- ================================================
-- 6. INSERT DEFAULT SYSTEM TEMPLATES
-- ================================================

-- Order Confirmation Template
INSERT INTO notification_templates (
  template_key,
  template_name,
  description,
  email_subject,
  email_body,
  email_html,
  sms_body,
  whatsapp_body,
  variables,
  is_system,
  is_active
) VALUES (
  'order_confirmation',
  'Order Confirmation',
  'Sent when customer places an order',
  'Order Confirmation - Order #{{order_number}}',
  'Hi {{customer_name}},

Your order #{{order_number}} has been confirmed!

Order Details:
- Total Amount: ₹{{total_amount}}
- Items: {{item_count}} item(s)
- Order Date: {{order_date}}

We will notify you once your order is shipped.

Thank you for shopping with us!',
  '<html><body><h2>Order Confirmation</h2><p>Hi {{customer_name}},</p><p>Your order <strong>#{{order_number}}</strong> has been confirmed!</p><table><tr><td>Total Amount:</td><td>₹{{total_amount}}</td></tr><tr><td>Items:</td><td>{{item_count}} item(s)</td></tr><tr><td>Order Date:</td><td>{{order_date}}</td></tr></table><p>We will notify you once your order is shipped.</p><p>Thank you for shopping with us!</p></body></html>',
  'Hi {{customer_name}}, Your order #{{order_number}} of ₹{{total_amount}} has been confirmed! We will notify you once shipped. Thank you!',
  'Hi {{customer_name}}! 🎉

Your order #{{order_number}} has been confirmed!

💰 Total: ₹{{total_amount}}
📦 Items: {{item_count}}
📅 Date: {{order_date}}

We''ll notify you once shipped. Thank you for shopping with us!',
  '["customer_name", "order_number", "total_amount", "item_count", "order_date"]'::jsonb,
  true,
  true
);

-- Payment Receipt Template
INSERT INTO notification_templates (
  template_key,
  template_name,
  description,
  email_subject,
  email_body,
  email_html,
  sms_body,
  whatsapp_body,
  variables,
  is_system,
  is_active
) VALUES (
  'payment_receipt',
  'Payment Receipt',
  'Sent when payment is successfully captured',
  'Payment Receipt - Order #{{order_number}}',
  'Hi {{customer_name}},

We have received your payment for Order #{{order_number}}.

Payment Details:
- Amount Paid: ₹{{amount}}
- Payment ID: {{payment_id}}
- Payment Method: {{payment_method}}
- Date: {{payment_date}}

Your order is now being processed.

Thank you!',
  '<html><body><h2>Payment Receipt</h2><p>Hi {{customer_name}},</p><p>We have received your payment for Order <strong>#{{order_number}}</strong>.</p><table><tr><td>Amount Paid:</td><td>₹{{amount}}</td></tr><tr><td>Payment ID:</td><td>{{payment_id}}</td></tr><tr><td>Payment Method:</td><td>{{payment_method}}</td></tr><tr><td>Date:</td><td>{{payment_date}}</td></tr></table><p>Your order is now being processed.</p><p>Thank you!</p></body></html>',
  'Hi {{customer_name}}, Payment of ₹{{amount}} received for Order #{{order_number}}. Payment ID: {{payment_id}}. Thank you!',
  'Hi {{customer_name}}! ✅

Payment received for Order #{{order_number}}!

💵 Amount: ₹{{amount}}
🔑 Payment ID: {{payment_id}}
💳 Method: {{payment_method}}
📅 Date: {{payment_date}}

Your order is being processed. Thank you!',
  '["customer_name", "order_number", "amount", "payment_id", "payment_method", "payment_date"]'::jsonb,
  true,
  true
);

-- Payment Failed Template
INSERT INTO notification_templates (
  template_key,
  template_name,
  description,
  email_subject,
  email_body,
  email_html,
  sms_body,
  whatsapp_body,
  variables,
  is_system,
  is_active
) VALUES (
  'payment_failed',
  'Payment Failed',
  'Sent when payment fails',
  'Payment Failed - Order #{{order_number}}',
  'Hi {{customer_name}},

Unfortunately, your payment for Order #{{order_number}} could not be processed.

Amount: ₹{{amount}}
Reason: {{failure_reason}}

Please try again or contact us for assistance.

Your order is reserved for the next 15 minutes.',
  '<html><body><h2>Payment Failed</h2><p>Hi {{customer_name}},</p><p>Unfortunately, your payment for Order <strong>#{{order_number}}</strong> could not be processed.</p><table><tr><td>Amount:</td><td>₹{{amount}}</td></tr><tr><td>Reason:</td><td>{{failure_reason}}</td></tr></table><p>Please try again or contact us for assistance.</p><p><strong>Note:</strong> Your order is reserved for the next 15 minutes.</p></body></html>',
  'Hi {{customer_name}}, Payment of ₹{{amount}} for Order #{{order_number}} failed. Please retry. Order reserved for 15 mins.',
  'Hi {{customer_name}},

Payment failed for Order #{{order_number}} ❌

💰 Amount: ₹{{amount}}
📝 Reason: {{failure_reason}}

Please try again. Your order is reserved for 15 minutes.',
  '["customer_name", "order_number", "amount", "failure_reason"]'::jsonb,
  true,
  true
);

-- Order Shipped Template
INSERT INTO notification_templates (
  template_key,
  template_name,
  description,
  email_subject,
  email_body,
  email_html,
  sms_body,
  whatsapp_body,
  variables,
  is_system,
  is_active
) VALUES (
  'order_shipped',
  'Order Shipped',
  'Sent when order is shipped',
  'Order Shipped - Order #{{order_number}}',
  'Hi {{customer_name}},

Great news! Your order #{{order_number}} has been shipped!

Tracking Details:
- Tracking Number: {{tracking_number}}
- Carrier: {{carrier_name}}
- Expected Delivery: {{expected_delivery}}

Track your order: {{tracking_url}}

Thank you!',
  '<html><body><h2>Order Shipped</h2><p>Hi {{customer_name}},</p><p>Great news! Your order <strong>#{{order_number}}</strong> has been shipped!</p><table><tr><td>Tracking Number:</td><td>{{tracking_number}}</td></tr><tr><td>Carrier:</td><td>{{carrier_name}}</td></tr><tr><td>Expected Delivery:</td><td>{{expected_delivery}}</td></tr></table><p><a href="{{tracking_url}}">Track your order</a></p><p>Thank you!</p></body></html>',
  'Hi {{customer_name}}, Your order #{{order_number}} has been shipped! Track: {{tracking_number}}. Expected delivery: {{expected_delivery}}',
  'Hi {{customer_name}}! 🚚

Your order #{{order_number}} is on its way!

📦 Tracking: {{tracking_number}}
🚛 Carrier: {{carrier_name}}
📅 Expected: {{expected_delivery}}

Track: {{tracking_url}}',
  '["customer_name", "order_number", "tracking_number", "carrier_name", "expected_delivery", "tracking_url"]'::jsonb,
  true,
  true
);

-- OTP Template
INSERT INTO notification_templates (
  template_key,
  template_name,
  description,
  email_subject,
  email_body,
  email_html,
  sms_body,
  whatsapp_body,
  variables,
  enabled_channels,
  is_system,
  is_active
) VALUES (
  'otp_verification',
  'OTP Verification',
  'Sent for account verification',
  'Your OTP Code - {{otp_code}}',
  'Your OTP code is: {{otp_code}}

This code will expire in {{expiry_minutes}} minutes.

If you did not request this, please ignore this message.',
  '<html><body><h2>OTP Verification</h2><p>Your OTP code is: <strong>{{otp_code}}</strong></p><p>This code will expire in <strong>{{expiry_minutes}}</strong> minutes.</p><p>If you did not request this, please ignore this message.</p></body></html>',
  'Your OTP is {{otp_code}}. Valid for {{expiry_minutes}} minutes. Do not share with anyone.',
  'Your OTP is *{{otp_code}}*

Valid for {{expiry_minutes}} minutes. Do not share with anyone.',
  '["otp_code", "expiry_minutes"]'::jsonb,
  '["email", "sms", "whatsapp"]'::jsonb,
  true,
  true
);

-- ================================================
-- MIGRATION COMPLETE
-- ================================================
