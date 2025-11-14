-- Migration: Add SaaS Platform Features
-- Date: 2025-01-01
-- Description: Adds new columns and tables for AI WhatsApp Business Platform

-- ============================================
-- 1. ADD NEW COLUMNS TO BUSINESSES TABLE
-- ============================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100);

-- Web Presence Type
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS web_presence_type VARCHAR(50);

-- Address
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS street_address VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);

-- Mini-Store
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mini_store_enabled BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mini_store_slug VARCHAR(100) UNIQUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mini_store_url VARCHAR(255);

-- Chat Widget
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS chat_widget_enabled BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS widget_code TEXT;

-- WhatsApp Integration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_api_token TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_phone_id VARCHAR(50);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_business_account_id VARCHAR(50);

-- Onboarding
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_percentage INT DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_businesses_mini_store_slug ON businesses(mini_store_slug);
CREATE INDEX IF NOT EXISTS idx_businesses_web_presence_type ON businesses(web_presence_type);

-- ============================================
-- 2. ADD NEW COLUMNS TO USERS TABLE
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_permissions JSON;

-- ============================================
-- 3. ADD NEW COLUMNS TO PRODUCTS TABLE
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_image_url VARCHAR(500);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_enhanced_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_generated_tags JSON;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- ============================================
-- 4. CREATE NEW TABLES
-- ============================================

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sku VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  quantity INT DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  variant_options JSON,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(tenant_id),
  name VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  whatsapp_number VARCHAR(20),
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  engagement_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(customer_id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  channel_conversation_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  assigned_to UUID REFERENCES users(user_id),
  escalation_level INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_business_status ON conversations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(customer_id),
  sender_type VARCHAR(20) NOT NULL,
  sender_id UUID REFERENCES users(user_id),
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT,
  media_url VARCHAR(255),
  media_type VARCHAR(50),
  ai_processed BOOLEAN DEFAULT false,
  ai_intent VARCHAR(100),
  ai_confidence DECIMAL(3, 2),
  ai_entities JSON,
  replied_by VARCHAR(20),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_ai_intent ON messages(ai_intent);

-- AI Training Data
CREATE TABLE IF NOT EXISTS ai_training_data (
  training_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(tenant_id),
  type VARCHAR(50) NOT NULL,
  question TEXT,
  answer TEXT,
  tags JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_training_data_business_active ON ai_training_data(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON ai_training_data(type);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_tenant_id ON ai_training_data(tenant_id);

-- Business Onboarding Steps
CREATE TABLE IF NOT EXISTS business_onboarding_steps (
  step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
  step_name VARCHAR(100) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_business_id ON business_onboarding_steps(business_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_is_completed ON business_onboarding_steps(is_completed);

-- ============================================
-- DONE!
-- ============================================

COMMENT ON COLUMN businesses.web_presence_type IS 'Values: no_website, static_website, functional_website';
COMMENT ON TABLE customers IS 'Customer records separate from leads';
COMMENT ON TABLE conversations IS 'Unified conversation threads across WhatsApp, Web Chat, etc.';
COMMENT ON TABLE messages IS 'Individual messages within conversations with AI processing';
COMMENT ON TABLE ai_training_data IS 'FAQs and knowledge base for AI training';
COMMENT ON TABLE business_onboarding_steps IS 'Tracks business onboarding progress';
