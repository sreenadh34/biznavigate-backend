-- Add WhatsApp catalog support to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS in_whatsapp_catalog BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_catalog_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS whatsapp_sync_status VARCHAR(50) DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS whatsapp_sync_error TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_synced_at TIMESTAMPTZ;

-- Create indexes for catalog queries
CREATE INDEX IF NOT EXISTS idx_products_whatsapp_catalog
ON products(business_id, in_whatsapp_catalog)
WHERE in_whatsapp_catalog = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_whatsapp_sync_status
ON products(business_id, whatsapp_sync_status);

-- Add comment
COMMENT ON COLUMN products.in_whatsapp_catalog IS 'Whether this product is included in WhatsApp Business catalog';
COMMENT ON COLUMN products.whatsapp_catalog_id IS 'WhatsApp catalog item ID from Meta API';
COMMENT ON COLUMN products.whatsapp_sync_status IS 'Sync status: not_synced, syncing, synced, failed';
COMMENT ON COLUMN products.whatsapp_sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN products.whatsapp_synced_at IS 'Last successful sync timestamp';
