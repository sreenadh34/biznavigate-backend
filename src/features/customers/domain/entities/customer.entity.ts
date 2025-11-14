/**
 * Customer Entity
 * Represents actual customers who purchase products or interact via WhatsApp
 * Distinct from leads (potential customers)
 */
export class Customer {
  customer_id: string;
  business_id: string;
  tenant_id: string;

  // Basic Information
  name?: string;
  phone: string; // Primary identifier (required)
  email?: string;
  whatsapp_number?: string;

  // Customer Metrics
  total_orders: number;
  total_spent: number;
  last_order_date?: Date;
  engagement_score: number; // 0-100, calculated based on interactions

  // Metadata
  created_at: Date;
  updated_at: Date;
}
