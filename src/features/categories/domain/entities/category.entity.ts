/**
 * Category Domain Entity
 * Represents a hierarchical product category
 */
export class Category {
  category_id: string;
  business_id: string;
  tenant_id: string;

  // Details
  name: string;
  slug: string;
  description?: string;

  // Hierarchy
  parent_category_id?: string;
  level: number;
  path?: string;

  // Display
  icon_url?: string;
  image_url?: string;
  display_order: number;

  // SEO
  meta_title?: string;
  meta_description?: string;

  // Status
  is_active: boolean;
  product_count: number;

  // Audit
  created_at: Date;
  updated_at: Date;
  created_by?: string;

  // Virtual fields for tree structure
  children?: Category[];
  parent?: Category;
}
