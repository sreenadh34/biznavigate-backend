-- Optimization indexes for products table to handle large datasets
-- Run with: npx prisma db execute --file ./migrations/optimize_products_indexes.sql --schema ./prisma/schema.prisma

-- These indexes already exist in schema.prisma (lines 542-546):
-- @@index([business_id, is_active], map: "idx_products_business_active")
-- @@index([tenant_id], map: "idx_products_tenant_id")
-- @@index([product_type], map: "idx_products_product_type")
-- @@index([slug], map: "idx_products_slug")
-- @@index([sku], map: "idx_products_sku")

-- Additional composite indexes for better query performance with large datasets

-- Enable pg_trgm extension for fuzzy text search (must be first)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for category filtering (commonly used in product listings)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;

-- Composite index for business + category queries
CREATE INDEX IF NOT EXISTS idx_products_business_category ON products(business_id, category) WHERE is_active = true;

-- Composite index for business + product_type (very common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_business_type_active ON products(business_id, product_type, is_active);

-- Index for name search (text search optimization)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Index for created_at for sorting by newest/oldest
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc ON products(created_at DESC);

-- Index for updated_at for recently modified products
CREATE INDEX IF NOT EXISTS idx_products_updated_at_desc ON products(updated_at DESC);

-- Composite index for business + stock availability queries
CREATE INDEX IF NOT EXISTS idx_products_business_in_stock ON products(business_id, in_stock) WHERE is_active = true;

-- Composite index for price range queries
CREATE INDEX IF NOT EXISTS idx_products_business_price ON products(business_id, price) WHERE is_active = true AND price IS NOT NULL;

-- Full-text search index for description
CREATE INDEX IF NOT EXISTS idx_products_description_fts ON products USING gin(to_tsvector('english', COALESCE(description, '')));

-- Analyze the table to update statistics for query planner
ANALYZE products;

-- Display index information
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
ORDER BY indexname;
