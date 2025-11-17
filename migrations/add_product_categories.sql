-- Product Categories Module
-- Supports hierarchical categories with unlimited depth

CREATE TABLE IF NOT EXISTS product_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  -- Category details
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hierarchy support
  parent_category_id UUID REFERENCES product_categories(category_id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 0,
  path VARCHAR(1000),

  -- Display
  icon_url VARCHAR(500),
  image_url VARCHAR(500),
  display_order INT DEFAULT 0,

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  product_count INT DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(user_id),

  -- Constraints
  CONSTRAINT unique_category_slug_per_business UNIQUE (business_id, slug),
  CONSTRAINT valid_level CHECK (level >= 0 AND level <= 5)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_business ON product_categories(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_path ON product_categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_level ON product_categories(level);

-- Add category reference to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(category_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Migrate existing category strings to new structure
DO $$
DECLARE
  business RECORD;
  cat_name TEXT;
  new_category_id UUID;
BEGIN
  FOR business IN SELECT DISTINCT business_id, tenant_id FROM products WHERE category IS NOT NULL
  LOOP
    FOR cat_name IN SELECT DISTINCT category FROM products WHERE business_id = business.business_id AND category IS NOT NULL
    LOOP
      INSERT INTO product_categories (business_id, tenant_id, name, slug, level, path)
      VALUES (
        business.business_id,
        business.tenant_id,
        cat_name,
        LOWER(REPLACE(REPLACE(cat_name, ' ', '-'), '&', 'and')),
        0,
        LOWER(REPLACE(REPLACE(cat_name, ' ', '-'), '&', 'and'))
      )
      ON CONFLICT (business_id, slug) DO NOTHING
      RETURNING category_id INTO new_category_id;

      IF new_category_id IS NOT NULL THEN
        UPDATE products SET category_id = new_category_id WHERE business_id = business.business_id AND category = cat_name;
      ELSE
        SELECT category_id INTO new_category_id FROM product_categories WHERE business_id = business.business_id AND name = cat_name;
        UPDATE products SET category_id = new_category_id WHERE business_id = business.business_id AND category = cat_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Update product_count for all categories
UPDATE product_categories c
SET product_count = (
  SELECT COUNT(*) FROM products p WHERE p.category_id = c.category_id AND p.is_active = true
);

-- Function to auto-update product_count
CREATE OR REPLACE FUNCTION update_category_product_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.category_id IS NOT NULL THEN
      UPDATE product_categories SET product_count = product_count + 1 WHERE category_id = NEW.category_id;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id AND OLD.category_id IS NOT NULL THEN
      UPDATE product_categories SET product_count = product_count - 1 WHERE category_id = OLD.category_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE product_categories SET product_count = product_count - 1 WHERE category_id = OLD.category_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_category_count
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION update_category_product_count();

COMMENT ON TABLE product_categories IS 'Hierarchical product categories with unlimited depth';

SELECT 'Categories migration completed successfully!' as message;
