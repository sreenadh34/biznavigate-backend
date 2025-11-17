-- AI Features for Inventory Module
-- Enables AI to read, understand, and enhance product data

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add AI-specific fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_embedding vector(1536);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_enhanced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_category_suggestions JSON DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_search_keywords TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_metadata JSON DEFAULT '{}';

-- Indexes for AI queries

-- 1. Vector similarity search (for "find similar products")
CREATE INDEX IF NOT EXISTS idx_products_ai_embedding
ON products USING ivfflat (ai_embedding vector_cosine_ops)
WITH (lists = 100);

-- 2. AI-generated tags search
CREATE INDEX IF NOT EXISTS idx_products_ai_tags
ON products USING gin(ai_generated_tags);

-- 3. Full-text search on AI-enhanced description
CREATE INDEX IF NOT EXISTS idx_products_ai_description_fts
ON products USING gin(to_tsvector('english', COALESCE(ai_enhanced_description, '')));

-- 4. AI search keywords
CREATE INDEX IF NOT EXISTS idx_products_ai_keywords
ON products USING gin(ai_search_keywords);

-- 5. AI-enhanced products filter
CREATE INDEX IF NOT EXISTS idx_products_ai_enhanced
ON products(ai_enhanced_at)
WHERE ai_enhanced_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN products.ai_embedding IS 'Vector embedding for semantic similarity search (1536 dimensions for OpenAI)';
COMMENT ON COLUMN products.ai_enhanced_description IS 'AI-generated improved product description';
COMMENT ON COLUMN products.ai_generated_tags IS 'AI-generated categorization tags';
COMMENT ON COLUMN products.ai_confidence_score IS 'AI confidence score (0.00 to 1.00)';
COMMENT ON COLUMN products.ai_category_suggestions IS 'AI-suggested categories with confidence scores';
COMMENT ON COLUMN products.ai_search_keywords IS 'AI-extracted keywords for search optimization';

-- Create AI audit table for tracking AI enhancements
CREATE TABLE IF NOT EXISTS ai_enhancements (
  enhancement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'product', 'inventory', etc.
  entity_id UUID NOT NULL,
  enhancement_type VARCHAR(50) NOT NULL, -- 'description', 'tags', 'category', 'embedding'
  original_value TEXT,
  enhanced_value TEXT,
  ai_provider VARCHAR(50), -- 'openai', 'claude', etc.
  ai_model VARCHAR(100), -- 'gpt-4', 'claude-3-opus', etc.
  confidence_score DECIMAL(3,2),
  prompt_used TEXT,
  tokens_used INT,
  processing_time_ms INT,
  user_accepted BOOLEAN DEFAULT NULL, -- NULL = pending, TRUE = accepted, FALSE = rejected
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSON DEFAULT '{}'
);

-- Indexes for AI enhancements table
CREATE INDEX idx_ai_enhancements_entity ON ai_enhancements(entity_type, entity_id);
CREATE INDEX idx_ai_enhancements_business ON ai_enhancements(business_id, created_at DESC);
CREATE INDEX idx_ai_enhancements_type ON ai_enhancements(enhancement_type);
CREATE INDEX idx_ai_enhancements_acceptance ON ai_enhancements(user_accepted) WHERE user_accepted IS NOT NULL;

-- Create AI queries table for natural language query logging
CREATE TABLE IF NOT EXISTS ai_queries (
  query_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  query_intent VARCHAR(100), -- 'search_products', 'check_stock', 'forecast_demand', etc.
  extracted_entities JSON, -- {"product_type": "electronics", "price_max": 1000, "condition": "low_stock"}
  generated_sql TEXT,
  results_count INT,
  execution_time_ms INT,
  ai_provider VARCHAR(50),
  ai_model VARCHAR(100),
  tokens_used INT,
  user_rating INT CHECK (user_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSON DEFAULT '{}'
);

-- Indexes for AI queries table
CREATE INDEX idx_ai_queries_business ON ai_queries(business_id, created_at DESC);
CREATE INDEX idx_ai_queries_intent ON ai_queries(query_intent);
CREATE INDEX idx_ai_queries_rating ON ai_queries(user_rating) WHERE user_rating IS NOT NULL;

-- Grant permissions (adjust as needed for your roles)
GRANT SELECT, INSERT, UPDATE ON ai_enhancements TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON ai_queries TO PUBLIC;

-- Display success message
SELECT
  'AI features installed successfully!' as status,
  COUNT(*) FILTER (WHERE schemaname = 'public' AND tablename = 'ai_enhancements') as ai_tables_created,
  COUNT(*) FILTER (WHERE indexname LIKE 'idx_products_ai%') as ai_indexes_created
FROM pg_indexes
WHERE schemaname = 'public';
