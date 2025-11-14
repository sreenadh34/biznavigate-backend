-- Migration: Add E-commerce Order Support
-- This migration enhances the orders table for e-commerce and creates order_items table

-- Step 1: Make lead_id optional (orders can come from customers directly, not just leads)
ALTER TABLE orders ALTER COLUMN lead_id DROP NOT NULL;

-- Step 2: Add customer_id column
ALTER TABLE orders ADD COLUMN customer_id UUID;

-- Step 3: Add foreign key for customer_id
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id);

-- Step 4: Add e-commerce specific columns to orders table
ALTER TABLE orders ADD COLUMN order_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(255);
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_state VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipping_pincode VARCHAR(20);
ALTER TABLE orders ADD COLUMN shipping_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN admin_notes TEXT;
ALTER TABLE orders ADD COLUMN source VARCHAR(50) DEFAULT 'whatsapp';

-- Step 5: Create order_items table for proper relational structure
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255),
  sku VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL,
  snapshot JSONB, -- Product details snapshot at order time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Step 6: Create indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Step 7: Add indexes for new order columns
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_source ON orders(source);

-- Step 8: Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Step 9: Add comments
COMMENT ON COLUMN orders.customer_id IS 'Customer who placed the order';
COMMENT ON COLUMN orders.order_number IS 'Human-readable order number (e.g., ORD-001)';
COMMENT ON COLUMN orders.status IS 'Order status: draft, pending, paid, processing, shipped, delivered, cancelled, refunded, failed';
COMMENT ON COLUMN orders.source IS 'Where order came from: whatsapp, instagram, website, facebook, manual, api';
COMMENT ON TABLE order_items IS 'Individual products in an order';
