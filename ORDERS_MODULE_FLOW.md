# Orders Module - Complete Flow Documentation

## Overview
The Orders Module handles the complete e-commerce order lifecycle from creation to fulfillment, integrated with Products and Customers modules.

---

## 1. Order Creation Flow

### Step-by-Step Process:

```
Customer → Product Selection → Create Order → Stock Deduction → Order Confirmation
```

### Example: Customer Orders 2 Products

**Scenario**: Rahul wants to buy a T-shirt and a Phone case

#### Input Request:
```json
POST /orders
{
  "business_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440000",
  "customer_id": "770e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "product_id": "880e8400-e29b-41d4-a716-446655440000",
      "variant_id": "990e8400-e29b-41d4-a716-446655440000",
      "quantity": 2,
      "discount": 50
    },
    {
      "product_id": "aa0e8400-e29b-41d4-a716-446655440000",
      "quantity": 1,
      "discount": 0
    }
  ],
  "discount_amount": 100,
  "tax_amount": 50,
  "shipping_fee": 40,
  "shipping_address": "123 Main Street, Apartment 4B",
  "shipping_city": "Mumbai",
  "shipping_state": "Maharashtra",
  "shipping_pincode": "400001",
  "shipping_phone": "+919876543210",
  "notes": "Please deliver before 6 PM",
  "source": "whatsapp"
}
```

#### What Happens Behind the Scenes:

**Step 1: Validation (OrderService)**
```typescript
// Validates business exists
✓ Business ID verified in database

// Validates customer exists
✓ Customer found: Rahul Sharma (+919876543210)

// Validates each product
✓ Product 1: T-shirt (Blue, Size L) - ₹500, Stock: 10
✓ Product 2: Phone Case - ₹300, Stock: 5
```

**Step 2: Price Calculation (OrderRepository - Transaction)**
```typescript
// Fetch product prices from database
T-shirt: ₹500 × 2 = ₹1000
Phone Case: ₹300 × 1 = ₹300

// Calculate subtotal
Subtotal = (₹1000 - ₹50) + (₹300 - ₹0) = ₹1250

// Calculate total
Total = ₹1250 (subtotal) + ₹50 (tax) + ₹40 (shipping) - ₹100 (discount)
Total = ₹1240
```

**Step 3: Order Creation (Database Transaction)**
```sql
-- Generate order number
SELECT COUNT(*) FROM orders WHERE business_id = '550e8400...'
-- Result: 42
-- Generated: ORD-00043

-- Create order record
INSERT INTO orders (
  order_id, business_id, tenant_id, customer_id,
  order_number, status, subtotal, discount_amount,
  tax_amount, shipping_fee, total_amount,
  payment_status, shipping_address, ...
) VALUES (
  'new-uuid', '550e8400...', '660e8400...', '770e8400...',
  'ORD-00043', 'pending', 1250, 100,
  50, 40, 1240,
  'pending', '123 Main Street...', ...
)
```

**Step 4: Create Order Items (with Product Snapshot)**
```sql
-- Item 1: T-shirt
INSERT INTO order_items (
  order_item_id, order_id, product_id, variant_id,
  product_name, variant_name, sku,
  quantity, unit_price, discount, total_price,
  snapshot
) VALUES (
  'item-uuid-1', 'order-uuid', '880e8400...', '990e8400...',
  'Cotton T-Shirt', 'Blue - L', 'TSH-BLU-L',
  2, 500, 50, 950,
  '{"product_name": "Cotton T-Shirt", "color": "Blue", ...}'
)

-- Item 2: Phone Case
INSERT INTO order_items (...) VALUES (...)
```

**Step 5: Stock Deduction**
```sql
-- T-shirt variant stock
UPDATE product_variants
SET quantity = quantity - 2,  -- 10 → 8
    in_stock = true
WHERE variant_id = '990e8400...'

-- Phone Case stock
UPDATE products
SET stock_quantity = stock_quantity - 1,  -- 5 → 4
    in_stock = true
WHERE product_id = 'aa0e8400...'
```

**Step 6: Update Customer Stats (Async)**
```sql
UPDATE customers
SET total_orders = total_orders + 1,     -- 5 → 6
    total_spent = total_spent + 1240,    -- ₹15,000 → ₹16,240
    last_order_date = NOW(),
    engagement_score = engagement_score + 5  -- 75 → 80
WHERE customer_id = '770e8400...'
```

#### Response:
```json
{
  "order_id": "new-uuid",
  "order_number": "ORD-00043",
  "status": "pending",
  "subtotal": 1250,
  "discount_amount": 100,
  "tax_amount": 50,
  "shipping_fee": 40,
  "total_amount": 1240,
  "payment_status": "pending",
  "customer_id": "770e8400...",
  "items": [
    {
      "order_item_id": "item-uuid-1",
      "product_name": "Cotton T-Shirt",
      "variant_name": "Blue - L",
      "quantity": 2,
      "unit_price": 500,
      "discount": 50,
      "total_price": 950
    },
    {
      "order_item_id": "item-uuid-2",
      "product_name": "Phone Case",
      "quantity": 1,
      "unit_price": 300,
      "total_price": 300
    }
  ],
  "created_at": "2025-01-11T12:00:00Z"
}
```

---

## 2. Order Payment Confirmation Flow

**Scenario**: Customer pays via UPI

```json
PATCH /orders/new-uuid/payment
{
  "payment_method": "upi",
  "payment_reference": "UPI-TXN-123456789"
}
```

**What Happens**:
```typescript
// Validates order exists and not already paid
✓ Order found: ORD-00043
✗ Payment status: pending (can proceed)

// Updates order
UPDATE orders SET
  payment_status = 'paid',
  payment_method = 'upi',
  payment_reference = 'UPI-TXN-123456789',
  paid_at = NOW(),
  status = 'paid'  -- Auto-transition
WHERE order_id = 'new-uuid'
```

---

## 3. Order Status Update Flow

**Order Lifecycle**:
```
draft → pending → paid → processing → shipped → delivered
                    ↓
                cancelled / refunded / failed
```

### Example: Marking Order as Shipped

```json
PATCH /orders/new-uuid/status
{
  "status": "shipped",
  "notes": "Shipped via FedEx"
}
```

**Validation**:
```typescript
// Check status transition is valid
Current: "paid"
New: "shipped"
Allowed transitions from "paid": [processing, refunded, cancelled]

❌ Invalid! Must be "processing" first

// Correct flow:
1. PATCH /status → "processing" ✓
2. PATCH /status → "shipped" ✓
```

---

## 4. Order Shipping Update Flow

```json
PATCH /orders/new-uuid/shipping
{
  "tracking_number": "FED123456789",
  "carrier": "FedEx"
}
```

**What Happens**:
```typescript
// Validates order is paid
✓ Payment status: paid

// Updates shipping info
UPDATE orders SET
  tracking_number = 'FED123456789',
  admin_notes = 'Carrier: FedEx',
  updated_at = NOW()

// Auto-updates status to shipped
UPDATE orders SET
  status = 'shipped',
  shipped_at = NOW()
```

---

## 5. Order Cancellation Flow

**Scenario**: Customer cancels order before shipping

```json
DELETE /orders/new-uuid
{
  "reason": "Customer requested cancellation"
}
```

**What Happens (Transaction)**:
```typescript
// Step 1: Fetch order with items
SELECT * FROM orders WHERE order_id = 'new-uuid'
SELECT * FROM order_items WHERE order_id = 'new-uuid'

// Step 2: Restore stock for each item
UPDATE product_variants
SET quantity = quantity + 2,  -- 8 → 10 (restored)
    in_stock = true
WHERE variant_id = '990e8400...'

UPDATE products
SET stock_quantity = stock_quantity + 1  -- 4 → 5 (restored)
WHERE product_id = 'aa0e8400...'

// Step 3: Update order status
UPDATE orders SET
  status = 'cancelled',
  cancelled_at = NOW(),
  admin_notes = 'Customer requested cancellation'
WHERE order_id = 'new-uuid'
```

---

## 6. Order Query/Filtering Flow

### Example: Get all pending orders from last week

```json
GET /orders?business_id=550e8400&status=pending&from_date=2025-01-04&to_date=2025-01-11&page=1&limit=20&sort_by=created_at&order=desc
```

**Query Built**:
```sql
SELECT o.*, oi.*, c.name, c.phone
FROM orders o
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.business_id = '550e8400...'
  AND o.status = 'pending'
  AND o.created_at >= '2025-01-04'
  AND o.created_at <= '2025-01-11'
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 0
```

**Search by Customer Name/Phone**:
```json
GET /orders?search=rahul&business_id=550e8400
```

```sql
WHERE o.business_id = '550e8400...'
  AND (
    o.order_number ILIKE '%rahul%'
    OR c.name ILIKE '%rahul%'
    OR c.phone LIKE '%rahul%'
  )
```

---

## 7. Order Analytics Flow

```json
GET /orders/stats/550e8400?startDate=2025-01-01&endDate=2025-01-31
```

**Calculations**:
```sql
-- Total orders
SELECT COUNT(*) FROM orders
WHERE business_id = '550e8400...'
  AND created_at BETWEEN '2025-01-01' AND '2025-01-31'
-- Result: 156 orders

-- Total revenue
SELECT SUM(total_amount) FROM orders
WHERE business_id = '550e8400...'
  AND payment_status = 'paid'
  AND created_at BETWEEN '2025-01-01' AND '2025-01-31'
-- Result: ₹193,400

-- Pending orders
SELECT COUNT(*) FROM orders
WHERE business_id = '550e8400...'
  AND status = 'pending'
-- Result: 23

-- Completed orders
SELECT COUNT(*) FROM orders
WHERE business_id = '550e8400...'
  AND status = 'delivered'
-- Result: 120

-- Average Order Value
AOV = ₹193,400 / 156 = ₹1,240
```

**Response**:
```json
{
  "total_orders": 156,
  "total_revenue": 193400,
  "pending_orders": 23,
  "completed_orders": 120,
  "average_order_value": 1240
}
```

---

## 8. Complete Real-World Example

### Scenario: WhatsApp Order Flow

**Step 1: Customer Discovery (Instagram)**
```
Customer sees product post on Instagram
↓
Comments: "Price?"
↓
Bot replies: "DM us for details!"
↓
Customer sends DM
```

**Step 2: AI Chat (Instagram DM)**
```
Customer: "I want the blue t-shirt"
AI: "Great! Blue T-Shirt is ₹500. Available sizes: S, M, L, XL. Which size?"
Customer: "L"
AI: "Perfect! To place your order, please message us on WhatsApp: wa.me/919876543210"
```

**Step 3: Customer Messages WhatsApp**
```
[Customer sends message on WhatsApp]
↓
System auto-creates customer record (findOrCreate)
↓
POST /customers/find-or-create
{
  "business_id": "550e8400...",
  "tenant_id": "660e8400...",
  "phone": "+919123456789",
  "name": "Extracted from WhatsApp profile"
}
```

**Step 4: AI Confirms Order Details (WhatsApp)**
```
AI: "Hi! I see you're interested in Blue T-Shirt (L) for ₹500.
     May I have your delivery address?"
Customer: "123 Main St, Mumbai 400001"
AI: "Great! Your total is ₹590 (₹500 + ₹40 shipping + ₹50 tax).
     Confirm order? Reply YES"
Customer: "YES"
```

**Step 5: System Creates Order**
```
POST /orders
{
  "business_id": "550e8400...",
  "customer_id": "customer-uuid",
  "items": [{
    "product_id": "880e8400...",
    "variant_id": "990e8400...",
    "quantity": 1
  }],
  "shipping_address": "123 Main St",
  "shipping_city": "Mumbai",
  "shipping_pincode": "400001",
  "source": "whatsapp"
}
```

**Step 6: Payment Collection**
```
AI sends UPI payment link
Customer pays
↓
PATCH /orders/order-uuid/payment
{
  "payment_method": "upi",
  "payment_reference": "UPI-TXN-XYZ"
}
```

**Step 7: Order Fulfillment**
```
Business owner sees order in dashboard
Packs product
↓
PATCH /orders/order-uuid/status
{ "status": "processing" }

Ships product
↓
PATCH /orders/order-uuid/shipping
{
  "tracking_number": "FED123456",
  "carrier": "FedEx"
}
↓
Status auto-updates to "shipped"

Customer receives
↓
PATCH /orders/order-uuid/status
{ "status": "delivered" }
```

**Step 8: Post-Delivery (Optional)**
```
System sends review request via WhatsApp
Customer engagement score increases
```

---

## Key Integration Points

### 1. With Products Module
- Fetches product prices at order time
- Creates product snapshots
- Manages stock deduction/restoration
- Validates product availability

### 2. With Customers Module
- Validates customer exists
- Updates customer statistics (total_orders, total_spent)
- Updates engagement scores
- Tracks last_order_date

### 3. With WhatsApp Module (Future)
- Auto-creates customers on first message
- AI handles order confirmation
- Sends order updates
- Collects payments

---

## Error Handling Examples

### Insufficient Stock
```json
POST /orders
Response: 400 Bad Request
{
  "error": "Insufficient stock for Cotton T-Shirt - Blue - L. Available: 1, Requested: 2"
}
```

### Invalid Status Transition
```json
PATCH /orders/xxx/status { "status": "delivered" }
Response: 400 Bad Request
{
  "error": "Invalid status transition: pending → delivered"
}
```

### Order Already Paid
```json
PATCH /orders/xxx/payment { ... }
Response: 409 Conflict
{
  "error": "Order is already paid"
}
```

---

## Performance Optimizations

1. **Database Transaction**: Ensures atomicity - if any step fails, entire order creation rolls back
2. **Stock Management**: Immediate deduction prevents overselling
3. **Product Snapshots**: Preserves pricing even if product details change later
4. **Async Customer Updates**: Non-blocking, doesn't slow down order creation
5. **Indexed Queries**: Fast filtering by status, date, customer, order_number

---

## Summary

The Orders Module provides:
- ✅ Complete order lifecycle management
- ✅ Automatic stock synchronization
- ✅ Customer statistics integration
- ✅ Transaction-safe operations
- ✅ Flexible querying and filtering
- ✅ Business analytics
- ✅ Multi-channel support (WhatsApp, Instagram, Website)
- ✅ Production-ready error handling
