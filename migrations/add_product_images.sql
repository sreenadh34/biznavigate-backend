-- Migration: Add product_images table for storing product images
-- Created: 2025-01-17
-- Description: Supports multiple images per product with ordering and metadata

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,

  -- Image storage info
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- Local path or S3 key
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100),
  storage_type VARCHAR(20) DEFAULT 'local', -- 'local' or 's3'

  -- Image metadata
  width INTEGER,
  height INTEGER,
  alt_text VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_business_id ON product_images(business_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON product_images(product_id, display_order);

-- Create partial unique index for primary images (PostgreSQL supports this)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_primary_per_product
ON product_images(product_id)
WHERE is_primary = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_product_images_updated_at
BEFORE UPDATE ON product_images
FOR EACH ROW
EXECUTE FUNCTION update_product_images_updated_at();

-- Add comments for documentation
COMMENT ON TABLE product_images IS 'Stores product images with support for local and S3 storage';
COMMENT ON COLUMN product_images.storage_type IS 'Storage backend: local or s3';
COMMENT ON COLUMN product_images.file_path IS 'Relative path for local storage or S3 key';
COMMENT ON COLUMN product_images.is_primary IS 'Primary image displayed in listings';
COMMENT ON COLUMN product_images.display_order IS 'Order of images in product gallery (lower = first)';
