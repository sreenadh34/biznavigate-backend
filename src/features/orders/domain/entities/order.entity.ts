/**
 * Order Entity
 * Represents a customer's order in the system
 */
export class Order {
  order_id: string;
  business_id: string;
  tenant_id: string;
  customer_id: string;

  // Order Details
  order_number: string; // Human-readable order number (e.g., "ORD-001")
  order_type: string; // Type of order (e.g., 'product', 'course', 'service')
  status: OrderStatus;

  // Pricing
  subtotal: number; // Sum of all items before discounts
  discount_amount: number; // Discount applied
  tax_amount: number; // Tax amount
  shipping_fee: number; // Shipping charges
  total_amount: number; // Final amount to pay

  // Payment
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference?: string; // UPI transaction ID, payment gateway ref, etc.
  paid_at?: Date;

  // Shipping
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_pincode?: string;
  shipping_phone?: string;

  tracking_number?: string;
  shipped_at?: Date;
  delivered_at?: Date;

  // Metadata
  notes?: string; // Customer notes or special instructions
  admin_notes?: string; // Internal notes
  source: OrderSource; // Where order came from (whatsapp, website, etc.)

  // Timestamps
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;

  // Relations (will be populated by repository)
  items?: OrderItem[];
}

/**
 * Order Item Entity
 * Represents individual products in an order
 */
export class OrderItem {
  order_item_id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;

  // Item Details
  product_name: string; // Snapshot of product name at order time
  variant_name?: string; // Snapshot of variant name
  sku?: string;

  // Pricing
  quantity: number;
  unit_price: number; // Price per unit at order time
  discount: number; // Discount on this item
  total_price: number; // (quantity * unit_price) - discount

  // Metadata
  snapshot: any; // JSON snapshot of product details at order time

  created_at: Date;
  updated_at: Date;
}

/**
 * Order Status Enum
 */
export enum OrderStatus {
  DRAFT = 'draft', // Order being created (not confirmed)
  PENDING = 'pending', // Confirmed but not paid
  PAID = 'paid', // Payment received
  PROCESSING = 'processing', // Being prepared/packed
  SHIPPED = 'shipped', // Shipped to customer
  DELIVERED = 'delivered', // Successfully delivered
  CANCELLED = 'cancelled', // Order cancelled
  REFUNDED = 'refunded', // Payment refunded
  FAILED = 'failed', // Payment/order failed
}

/**
 * Payment Method Enum
 */
export enum PaymentMethod {
  UPI = 'upi',
  CARD = 'card',
  NET_BANKING = 'net_banking',
  CASH_ON_DELIVERY = 'cod',
  WALLET = 'wallet',
  OTHER = 'other',
}

/**
 * Payment Status Enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Order Source Enum
 */
export enum OrderSource {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  WEBSITE = 'website',
  FACEBOOK = 'facebook',
  MANUAL = 'manual', // Manually created by owner
  API = 'api',
}
