-- Migration: Add Payments System for Razorpay Integration
-- Handles: Payment tracking, webhooks, refunds, reconciliation
-- Production-ready: Supports thousands of concurrent payments

-- Step 1: Create payments table
CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,

  -- Razorpay identifiers
  razorpay_order_id VARCHAR(255) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  razorpay_signature VARCHAR(500),

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'created', -- created, authorized, captured, failed, refunded, partial_refund
  method VARCHAR(50), -- card, netbanking, wallet, upi, etc.

  -- Additional metadata
  receipt VARCHAR(255),
  description TEXT,
  notes JSONB,

  -- Webhook tracking
  webhook_received_at TIMESTAMPTZ,
  webhook_processed_at TIMESTAMPTZ,
  webhook_attempts INT DEFAULT 0,

  -- Refund tracking
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,

  -- Payment timeline
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_payment_business FOREIGN KEY (business_id) REFERENCES businesses(business_id),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),

  -- Constraints
  CONSTRAINT chk_payment_amount CHECK (amount > 0),
  CONSTRAINT chk_refund_amount CHECK (refund_amount >= 0 AND refund_amount <= amount),
  CONSTRAINT chk_payment_status CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded', 'partial_refund'))
);

-- Step 2: Create payment_webhooks table for audit trail
CREATE TABLE IF NOT EXISTS payment_webhooks (
  webhook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID,

  -- Webhook details
  event_type VARCHAR(100) NOT NULL, -- payment.authorized, payment.captured, payment.failed, etc.
  razorpay_event_id VARCHAR(255) UNIQUE NOT NULL,

  -- Raw payload for debugging
  payload JSONB NOT NULL,
  signature VARCHAR(500),

  -- Processing status
  status VARCHAR(50) DEFAULT 'pending', -- pending, processed, failed, duplicate
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_webhook_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL
);

-- Step 3: Create payment_reconciliation table for daily settlement matching
CREATE TABLE IF NOT EXISTS payment_reconciliation (
  reconciliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,

  -- Reconciliation period
  settlement_date DATE NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,

  -- Summary
  total_payments INT DEFAULT 0,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  total_fees DECIMAL(10, 2) DEFAULT 0,
  net_amount DECIMAL(10, 2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, matched, mismatched, resolved
  razorpay_settlement_id VARCHAR(255),

  -- Discrepancies
  discrepancy_count INT DEFAULT 0,
  discrepancy_details JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key
  CONSTRAINT fk_reconciliation_business FOREIGN KEY (business_id) REFERENCES businesses(business_id),

  -- Unique constraint per business per day
  CONSTRAINT uniq_reconciliation_business_date UNIQUE (business_id, settlement_date)
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_business_id ON payments(business_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX idx_payments_razorpay_payment_id ON payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

CREATE INDEX idx_webhooks_payment_id ON payment_webhooks(payment_id);
CREATE INDEX idx_webhooks_event_type ON payment_webhooks(event_type);
CREATE INDEX idx_webhooks_razorpay_event_id ON payment_webhooks(razorpay_event_id);
CREATE INDEX idx_webhooks_status ON payment_webhooks(status);
CREATE INDEX idx_webhooks_received_at ON payment_webhooks(received_at);

CREATE INDEX idx_reconciliation_business_id ON payment_reconciliation(business_id);
CREATE INDEX idx_reconciliation_settlement_date ON payment_reconciliation(settlement_date);
CREATE INDEX idx_reconciliation_status ON payment_reconciliation(status);

-- Step 5: Add updated_at trigger for payments
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_payments_updated_at();

-- Step 6: Add comments for documentation
COMMENT ON TABLE payments IS 'Payment transactions with Razorpay integration';
COMMENT ON COLUMN payments.razorpay_order_id IS 'Razorpay order ID (created before payment)';
COMMENT ON COLUMN payments.razorpay_payment_id IS 'Razorpay payment ID (after customer completes payment)';
COMMENT ON COLUMN payments.razorpay_signature IS 'Webhook signature for verification';
COMMENT ON COLUMN payments.status IS 'Payment status: created -> authorized -> captured';
COMMENT ON COLUMN payments.webhook_attempts IS 'Number of webhook retry attempts';

COMMENT ON TABLE payment_webhooks IS 'Audit trail of all payment webhooks from Razorpay';
COMMENT ON COLUMN payment_webhooks.event_type IS 'Razorpay event type (payment.authorized, etc.)';
COMMENT ON COLUMN payment_webhooks.payload IS 'Raw webhook payload for debugging';

COMMENT ON TABLE payment_reconciliation IS 'Daily payment reconciliation with Razorpay settlements';
