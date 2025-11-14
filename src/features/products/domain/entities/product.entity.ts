/**
 * Product Entity
 * Represents a product in the system (physical product, course, event, service)
 */
export class Product {
  product_id: string;
  business_id: string;
  tenant_id: string;
  product_type: string; // 'physical', 'course', 'event', 'service'
  name: string;
  description?: string;
  category?: string;
  price?: number;
  stock_quantity?: number;
  image_urls?: any; // JSON array of image URLs
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  // New fields for e-commerce and AI
  sku?: string;
  compare_price?: number;
  currency?: string;
  track_inventory?: boolean;
  in_stock?: boolean;
  primary_image_url?: string;
  ai_enhanced_description?: string;
  ai_generated_tags?: any; // JSON array
  has_variants?: boolean;
  slug?: string;
}

/**
 * Product Variant Entity
 * Represents variations of a product (e.g., different sizes, colors)
 */
export class ProductVariant {
  variant_id: string;
  product_id: string;
  name: string; // e.g., "50ml", "Red", "Large"
  sku?: string;
  price: number;
  quantity: number;
  in_stock: boolean;
  variant_options?: any; // JSON: { "size": "50ml", "color": "red" }
  created_at: Date;
  updated_at: Date;
}
