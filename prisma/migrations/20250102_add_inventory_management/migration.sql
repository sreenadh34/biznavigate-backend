-- ============================================
-- INVENTORY MANAGEMENT SYSTEM
-- Production-ready multi-warehouse inventory tracking
-- ============================================

-- ============================================
-- 1. WAREHOUSES/LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Warehouse Details
  warehouse_name VARCHAR(255) NOT NULL,
  warehouse_code VARCHAR(50) NOT NULL, -- Unique code per business
  warehouse_type VARCHAR(50) DEFAULT 'warehouse', -- warehouse, store, fulfillment_center, dropship

  -- Address
  address_line1 VARCHAR(500),
  address_line2 VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',

  -- Contact
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),

  -- Capacity & Settings
  total_capacity INT, -- Total storage capacity
  used_capacity INT DEFAULT 0, -- Currently used capacity
  is_default BOOLEAN DEFAULT false, -- Default warehouse for new products
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5, -- Priority for stock allocation (1=highest)

  -- Operating Hours
  operating_hours JSONB DEFAULT '{}'::jsonb, -- {monday: {open: "09:00", close: "18:00"}, ...}

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_warehouse_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_warehouse_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT unique_warehouse_code_per_business UNIQUE (business_id, warehouse_code),
  CONSTRAINT check_capacity CHECK (used_capacity >= 0 AND (total_capacity IS NULL OR used_capacity <= total_capacity)),
  CONSTRAINT check_priority CHECK (priority >= 1 AND priority <= 10)
);

-- ============================================
-- 2. INVENTORY LEVELS TABLE
-- Real-time stock levels per product variant per warehouse
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_levels (
  inventory_level_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  variant_id UUID NOT NULL,

  -- Stock Quantities
  available_quantity INT DEFAULT 0, -- Available for sale
  reserved_quantity INT DEFAULT 0, -- Reserved in orders (already handled in product_variants)
  damaged_quantity INT DEFAULT 0, -- Damaged/defective stock
  in_transit_quantity INT DEFAULT 0, -- Stock being transferred

  -- Reorder Settings
  reorder_point INT DEFAULT 10, -- Trigger reorder when stock falls below this
  reorder_quantity INT DEFAULT 50, -- Quantity to reorder
  max_stock_level INT, -- Maximum stock to maintain

  -- Cost & Valuation
  average_cost DECIMAL(15, 2) DEFAULT 0, -- Weighted average cost
  total_value DECIMAL(15, 2) DEFAULT 0, -- Total inventory value

  -- Location in Warehouse
  bin_location VARCHAR(100), -- Specific location in warehouse (e.g., "A-12-3")
  aisle VARCHAR(50),
  shelf VARCHAR(50),

  -- Stock Status
  last_counted_at TIMESTAMPTZ, -- Last physical count
  last_restock_at TIMESTAMPTZ, -- Last time stock was added
  is_low_stock BOOLEAN DEFAULT false, -- Auto-updated when below reorder point
  is_out_of_stock BOOLEAN DEFAULT false, -- Auto-updated when quantity = 0

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_inventory_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(variant_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT unique_variant_per_warehouse UNIQUE (warehouse_id, variant_id),
  CONSTRAINT check_quantities CHECK (
    available_quantity >= 0 AND
    reserved_quantity >= 0 AND
    damaged_quantity >= 0 AND
    in_transit_quantity >= 0
  )
);

-- ============================================
-- 3. STOCK MOVEMENTS TABLE
-- Complete audit trail of all inventory changes
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  inventory_level_id UUID NOT NULL,

  -- Movement Details
  movement_type VARCHAR(50) NOT NULL,
  -- Types: purchase, sale, return, adjustment, transfer_in, transfer_out,
  --        damaged, expired, theft, found, recount, manufacturing

  movement_date TIMESTAMPTZ DEFAULT NOW(),
  reference_type VARCHAR(100), -- order, purchase_order, transfer, adjustment, etc.
  reference_id UUID, -- ID of the related entity

  -- Quantity Changes
  quantity_change INT NOT NULL, -- Positive for additions, negative for reductions
  quantity_before INT NOT NULL, -- Stock level before movement
  quantity_after INT NOT NULL, -- Stock level after movement

  -- Cost Information
  unit_cost DECIMAL(15, 2), -- Cost per unit for this movement
  total_cost DECIMAL(15, 2), -- Total cost of this movement

  -- From/To (for transfers)
  from_warehouse_id UUID, -- Source warehouse for transfers
  to_warehouse_id UUID, -- Destination warehouse for transfers

  -- Reason & Notes
  reason VARCHAR(255), -- Brief reason for movement
  notes TEXT, -- Detailed notes

  -- User Tracking
  created_by UUID, -- User who created this movement
  approved_by UUID, -- User who approved (for adjustments)

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_movement_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_movement_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_movement_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT fk_movement_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  CONSTRAINT fk_movement_inventory_level FOREIGN KEY (inventory_level_id)
    REFERENCES inventory_levels(inventory_level_id) ON DELETE CASCADE,
  CONSTRAINT fk_movement_from_warehouse FOREIGN KEY (from_warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
  CONSTRAINT fk_movement_to_warehouse FOREIGN KEY (to_warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT check_movement_type CHECK (movement_type IN (
    'purchase', 'sale', 'return', 'adjustment', 'transfer_in', 'transfer_out',
    'damaged', 'expired', 'theft', 'found', 'recount', 'manufacturing'
  )),
  CONSTRAINT check_quantity_after CHECK (quantity_after = quantity_before + quantity_change)
);

-- ============================================
-- 4. STOCK TRANSFERS TABLE
-- Inter-warehouse stock transfers
-- ============================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Transfer Details
  transfer_number VARCHAR(100) UNIQUE NOT NULL, -- Auto-generated: TRF-20250102-0001
  from_warehouse_id UUID NOT NULL,
  to_warehouse_id UUID NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_transit, completed, cancelled

  -- Items (stored as JSONB array)
  items JSONB NOT NULL, -- [{variant_id, quantity, notes}, ...]

  -- Dates
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  shipped_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,
  expected_delivery_date TIMESTAMPTZ,

  -- Tracking
  tracking_number VARCHAR(255),
  carrier VARCHAR(100),

  -- User Tracking
  requested_by UUID,
  approved_by UUID,
  shipped_by UUID,
  received_by UUID,

  -- Notes
  notes TEXT,
  rejection_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_transfer_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_transfer_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_transfer_from_warehouse FOREIGN KEY (from_warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT fk_transfer_to_warehouse FOREIGN KEY (to_warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT check_different_warehouses CHECK (from_warehouse_id != to_warehouse_id),
  CONSTRAINT check_transfer_status CHECK (status IN ('pending', 'approved', 'in_transit', 'completed', 'cancelled', 'rejected'))
);

-- ============================================
-- 5. STOCK ALERTS TABLE
-- Low stock and reorder alerts
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  inventory_level_id UUID NOT NULL,

  -- Alert Details
  alert_type VARCHAR(50) NOT NULL, -- low_stock, out_of_stock, overstock, reorder_needed
  severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical

  -- Stock Information
  current_quantity INT NOT NULL,
  reorder_point INT,
  recommended_order_quantity INT,

  -- Alert Status
  status VARCHAR(50) DEFAULT 'active', -- active, acknowledged, resolved, ignored

  -- Resolution
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  -- Notification
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_alert_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_inventory_level FOREIGN KEY (inventory_level_id)
    REFERENCES inventory_levels(inventory_level_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT check_alert_type CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock', 'reorder_needed')),
  CONSTRAINT check_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT check_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored'))
);

-- ============================================
-- 6. STOCK COUNTS TABLE
-- Physical inventory counts for reconciliation
-- ============================================
CREATE TABLE IF NOT EXISTS stock_counts (
  count_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,

  -- Count Details
  count_number VARCHAR(100) UNIQUE NOT NULL, -- Auto-generated: CNT-20250102-0001
  count_type VARCHAR(50) DEFAULT 'full', -- full, partial, cycle

  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, completed, cancelled

  -- Schedule
  scheduled_date DATE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Items (results stored after count)
  items JSONB DEFAULT '[]'::jsonb, -- [{variant_id, expected_qty, actual_qty, variance, notes}, ...]

  -- Summary
  total_items_counted INT DEFAULT 0,
  total_variances INT DEFAULT 0,
  total_value_variance DECIMAL(15, 2) DEFAULT 0,

  -- User Tracking
  created_by UUID,
  counted_by UUID,
  approved_by UUID,

  -- Notes
  notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign Keys
  CONSTRAINT fk_count_business FOREIGN KEY (business_id)
    REFERENCES businesses(business_id) ON DELETE CASCADE,
  CONSTRAINT fk_count_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_count_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT check_count_type CHECK (count_type IN ('full', 'partial', 'cycle')),
  CONSTRAINT check_count_status CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))
);

-- ============================================
-- INDEXES FOR HIGH PERFORMANCE
-- Optimized for thousands of concurrent users
-- ============================================

-- Warehouses indexes
CREATE INDEX idx_warehouses_business_id ON warehouses(business_id);
CREATE INDEX idx_warehouses_tenant_id ON warehouses(tenant_id);
CREATE INDEX idx_warehouses_is_active ON warehouses(is_active);
CREATE INDEX idx_warehouses_is_default ON warehouses(business_id, is_default) WHERE is_default = true;

-- Inventory Levels indexes (most queried table)
CREATE INDEX idx_inventory_levels_business_id ON inventory_levels(business_id);
CREATE INDEX idx_inventory_levels_warehouse_id ON inventory_levels(warehouse_id);
CREATE INDEX idx_inventory_levels_variant_id ON inventory_levels(variant_id);
CREATE INDEX idx_inventory_levels_low_stock ON inventory_levels(business_id, is_low_stock) WHERE is_low_stock = true;
CREATE INDEX idx_inventory_levels_out_of_stock ON inventory_levels(business_id, is_out_of_stock) WHERE is_out_of_stock = true;
CREATE INDEX idx_inventory_levels_available_qty ON inventory_levels(warehouse_id, available_quantity);

-- Stock Movements indexes (audit trail - heavy writes)
CREATE INDEX idx_stock_movements_business_id ON stock_movements(business_id);
CREATE INDEX idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_variant_id ON stock_movements(variant_id);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_movement_date ON stock_movements(movement_date DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Stock Transfers indexes
CREATE INDEX idx_stock_transfers_business_id ON stock_transfers(business_id);
CREATE INDEX idx_stock_transfers_from_warehouse ON stock_transfers(from_warehouse_id);
CREATE INDEX idx_stock_transfers_to_warehouse ON stock_transfers(to_warehouse_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX idx_stock_transfers_requested_date ON stock_transfers(requested_date DESC);

-- Stock Alerts indexes
CREATE INDEX idx_stock_alerts_business_id ON stock_alerts(business_id);
CREATE INDEX idx_stock_alerts_warehouse_id ON stock_alerts(warehouse_id);
CREATE INDEX idx_stock_alerts_variant_id ON stock_alerts(variant_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(business_id, status) WHERE status = 'active';
CREATE INDEX idx_stock_alerts_alert_type ON stock_alerts(alert_type);

-- Stock Counts indexes
CREATE INDEX idx_stock_counts_business_id ON stock_counts(business_id);
CREATE INDEX idx_stock_counts_warehouse_id ON stock_counts(warehouse_id);
CREATE INDEX idx_stock_counts_status ON stock_counts(status);
CREATE INDEX idx_stock_counts_scheduled_date ON stock_counts(scheduled_date);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATES
-- ============================================

-- Update warehouse used_capacity when inventory changes
CREATE OR REPLACE FUNCTION update_warehouse_capacity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE warehouses
  SET used_capacity = (
    SELECT COALESCE(SUM(available_quantity + reserved_quantity + damaged_quantity), 0)
    FROM inventory_levels
    WHERE warehouse_id = NEW.warehouse_id
  ),
  updated_at = NOW()
  WHERE warehouse_id = NEW.warehouse_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_capacity
AFTER INSERT OR UPDATE OF available_quantity, reserved_quantity, damaged_quantity
ON inventory_levels
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_capacity();

-- Auto-update low_stock and out_of_stock flags
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_out_of_stock := (NEW.available_quantity = 0);
  NEW.is_low_stock := (NEW.available_quantity > 0 AND NEW.available_quantity <= NEW.reorder_point);
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_stock_levels
BEFORE INSERT OR UPDATE OF available_quantity, reorder_point
ON inventory_levels
FOR EACH ROW
EXECUTE FUNCTION check_stock_levels();

-- Auto-create stock alerts when low stock detected
CREATE OR REPLACE FUNCTION create_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Create alert for low stock (if not already exists)
  IF NEW.is_low_stock = true AND NOT NEW.is_out_of_stock THEN
    INSERT INTO stock_alerts (
      business_id, tenant_id, warehouse_id, variant_id, inventory_level_id,
      alert_type, severity, current_quantity, reorder_point, recommended_order_quantity
    )
    SELECT
      NEW.business_id, NEW.tenant_id, NEW.warehouse_id, NEW.variant_id, NEW.inventory_level_id,
      'low_stock', 'warning', NEW.available_quantity, NEW.reorder_point, NEW.reorder_quantity
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE inventory_level_id = NEW.inventory_level_id
        AND alert_type = 'low_stock'
        AND status = 'active'
    );
  END IF;

  -- Create alert for out of stock (if not already exists)
  IF NEW.is_out_of_stock = true THEN
    INSERT INTO stock_alerts (
      business_id, tenant_id, warehouse_id, variant_id, inventory_level_id,
      alert_type, severity, current_quantity, reorder_point, recommended_order_quantity
    )
    SELECT
      NEW.business_id, NEW.tenant_id, NEW.warehouse_id, NEW.variant_id, NEW.inventory_level_id,
      'out_of_stock', 'critical', 0, NEW.reorder_point, NEW.reorder_quantity
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE inventory_level_id = NEW.inventory_level_id
        AND alert_type = 'out_of_stock'
        AND status = 'active'
    );
  END IF;

  -- Auto-resolve alerts if stock is restored
  IF NEW.available_quantity > NEW.reorder_point THEN
    UPDATE stock_alerts
    SET status = 'resolved',
        resolved_at = NOW(),
        resolution_notes = 'Stock replenished automatically'
    WHERE inventory_level_id = NEW.inventory_level_id
      AND status = 'active'
      AND alert_type IN ('low_stock', 'out_of_stock');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_stock_alert
AFTER UPDATE OF is_low_stock, is_out_of_stock
ON inventory_levels
FOR EACH ROW
EXECUTE FUNCTION create_stock_alert();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_stock_alerts_updated_at BEFORE UPDATE ON stock_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_stock_counts_updated_at BEFORE UPDATE ON stock_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE warehouses IS 'Physical warehouses and storage locations for inventory management';
COMMENT ON TABLE inventory_levels IS 'Real-time inventory levels per product variant per warehouse';
COMMENT ON TABLE stock_movements IS 'Complete audit trail of all inventory changes';
COMMENT ON TABLE stock_transfers IS 'Inter-warehouse stock transfer requests and tracking';
COMMENT ON TABLE stock_alerts IS 'Automated alerts for low stock, out of stock, and reorder needs';
COMMENT ON TABLE stock_counts IS 'Physical inventory counts for reconciliation';
