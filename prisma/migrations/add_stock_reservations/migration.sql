-- Migration: Add Stock Reservation System for Production Scalability
-- Handles: Race conditions, concurrent orders, payment timeouts

-- Step 1: Add version column for optimistic locking
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Step 2: Create stock_reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
  reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  product_id UUID NOT NULL,
  variant_id UUID,
  quantity INTEGER NOT NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, converted, expired, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_reservation_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_reservation_product FOREIGN KEY (product_id) REFERENCES products(product_id),
  CONSTRAINT chk_reservation_status CHECK (status IN ('active', 'converted', 'expired', 'cancelled'))
);

-- Step 3: Add indexes for performance
CREATE INDEX idx_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX idx_reservations_product_id ON stock_reservations(product_id);
CREATE INDEX idx_reservations_variant_id ON stock_reservations(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_reservations_expires_at ON stock_reservations(expires_at) WHERE status = 'active';
CREATE INDEX idx_reservations_status ON stock_reservations(status);

-- Step 4: Add reserved_stock column to track reservations
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;

-- Step 5: Add payment_expires_at to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

-- Step 6: Add unique constraint to prevent duplicate reservations
CREATE UNIQUE INDEX idx_active_reservation_per_order
ON stock_reservations(order_id)
WHERE status = 'active';

-- Step 7: Create function to calculate available stock
CREATE OR REPLACE FUNCTION get_available_stock(p_product_id UUID, p_variant_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  total_stock INTEGER;
  reserved INTEGER;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT quantity, reserved_stock INTO total_stock, reserved
    FROM product_variants
    WHERE variant_id = p_variant_id;
  ELSE
    SELECT stock_quantity, reserved_stock INTO total_stock, reserved
    FROM products
    WHERE product_id = p_product_id;
  END IF;

  RETURN COALESCE(total_stock, 0) - COALESCE(reserved, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add comments
COMMENT ON TABLE stock_reservations IS 'Temporary stock holds for unpaid orders';
COMMENT ON COLUMN stock_reservations.expires_at IS 'Reservation auto-releases after this time';
COMMENT ON COLUMN products.reserved_stock IS 'Stock currently reserved for pending orders';
COMMENT ON COLUMN product_variants.reserved_stock IS 'Stock currently reserved for pending orders';
COMMENT ON COLUMN orders.payment_expires_at IS 'Order auto-cancels if payment not received by this time';
