-- Campaign Module Enhancements for WhatsApp Template Support
-- This migration adds support for WhatsApp templates, audience segmentation, and campaign analytics

-- Add new columns to campaigns table for better template management
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES notification_templates(template_id),
ADD COLUMN IF NOT EXISTS whatsapp_template_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS whatsapp_template_language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS template_parameters JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS media_url VARCHAR(1000),
ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(product_id),
ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'all',
ADD COLUMN IF NOT EXISTS audience_filter JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_recipients INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS sent_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicked_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS converted_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for campaign queries
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_product_id ON campaigns(product_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_audience_type ON campaigns(audience_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Add error_message column to campaign_recipients for better error tracking
ALTER TABLE campaign_recipients
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for better recipient tracking
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status_sent ON campaign_recipients(status, sent_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN campaigns.template_id IS 'Reference to reusable notification template';
COMMENT ON COLUMN campaigns.whatsapp_template_name IS 'WhatsApp Business API approved template name';
COMMENT ON COLUMN campaigns.whatsapp_template_language IS 'Template language code (e.g., en, hi, ta)';
COMMENT ON COLUMN campaigns.template_parameters IS 'Dynamic parameters for template variables';
COMMENT ON COLUMN campaigns.media_url IS 'URL of media (image/video) to send with campaign';
COMMENT ON COLUMN campaigns.media_type IS 'Type of media: image, video, document';
COMMENT ON COLUMN campaigns.product_id IS 'Optional product reference for product-based campaigns';
COMMENT ON COLUMN campaigns.audience_type IS 'Target audience: all, leads, customers, segment';
COMMENT ON COLUMN campaigns.audience_filter IS 'JSON filter criteria for audience selection';
COMMENT ON COLUMN campaigns.total_recipients IS 'Total number of recipients for this campaign';
COMMENT ON COLUMN campaigns.sent_count IS 'Number of messages successfully sent';
COMMENT ON COLUMN campaigns.delivered_count IS 'Number of messages delivered';
COMMENT ON COLUMN campaigns.failed_count IS 'Number of failed message deliveries';
COMMENT ON COLUMN campaigns.clicked_count IS 'Number of recipients who clicked campaign links';
COMMENT ON COLUMN campaigns.converted_count IS 'Number of recipients who converted';
