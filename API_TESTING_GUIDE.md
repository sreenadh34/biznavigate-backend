# Complete API Testing Guide - Customers, Orders & Payments

## Prerequisites

1. **Database Setup**:
```bash
# Run migration
npx prisma db push

# Generate Prisma client
npx prisma generate
```

2. **Environment Variables** (`.env`):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/biznavigate?schema=public"
JWT_SECRET=your-secret-key-here
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

3. **Get JWT Token** (Authentication):
```bash
# Login to get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'

# Response will contain:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refresh_token": "..."
# }

# Use this token in Authorization header for all requests
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Complete E-Commerce Flow with Examples

### SCENARIO: Customer orders a T-Shirt and pays via Razorpay

Let's walk through the complete flow step by step with real API calls.

---

## Step 1: Create a Customer

### API: POST /customers

**Create customer when they message on WhatsApp for first time**

```bash
curl -X POST http://localhost:3000/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "550e8400-e29b-41d4-a716-446655440001",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Rahul Sharma",
    "phone": "919876543210",
    "email": "rahul.sharma@example.com",
    "whatsapp_number": "919876543210"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "customer_id": "c1234567-89ab-cdef-0123-456789abcdef",
    "business_id": "550e8400-e29b-41d4-a716-446655440001",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Rahul Sharma",
    "phone": "919876543210",
    "email": "rahul.sharma@example.com",
    "whatsapp_number": "919876543210",
    "total_orders": 0,
    "total_spent": 0,
    "engagement_score": 10,
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T10:00:00.000Z"
  }
}
```

**Database Record:**
```sql
-- In customers table
customer_id: c1234567-89ab-cdef-0123-456789abcdef
name: Rahul Sharma
phone: 919876543210
email: rahul.sharma@example.com
total_orders: 0
total_spent: 0.00
engagement_score: 10
last_order_date: NULL
```

---

## Step 2: Check Product Stock

### API: GET /products/:id/stock/check

**Check if T-Shirt (Blue, Large) is available**

```bash
curl -X GET "http://localhost:3000/products/p1234567-89ab-cdef-0123-456789abcdef/stock/check?variantId=v1234567-89ab-cdef-0123-456789abcdef" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Stock check completed",
  "data": {
    "product_id": "p1234567-89ab-cdef-0123-456789abcdef",
    "variant_id": "v1234567-89ab-cdef-0123-456789abcdef",
    "product_name": "Premium Cotton T-Shirt",
    "variant_details": "Blue - Large",
    "stock_quantity": 50,
    "reserved_stock": 5,
    "available_stock": 45,
    "in_stock": true
  }
}
```

**Database State:**
```sql
-- products table
product_id: p1234567-89ab-cdef-0123-456789abcdef
name: Premium Cotton T-Shirt
price: 999.00
stock_quantity: 50
reserved_stock: 5
version: 10

-- product_variants table
variant_id: v1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
sku: TSHIRT-BLUE-L
price: 999.00
stock_quantity: 50
reserved_stock: 5
```

---

## Step 3: Create Order (Stock Reserved)

### API: POST /orders

**Customer adds T-Shirt to cart and creates order**

```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "550e8400-e29b-41d4-a716-446655440001",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "c1234567-89ab-cdef-0123-456789abcdef",
    "order_type": "product",
    "source": "whatsapp",
    "items": [
      {
        "product_id": "p1234567-89ab-cdef-0123-456789abcdef",
        "variant_id": "v1234567-89ab-cdef-0123-456789abcdef",
        "quantity": 2,
        "price": 999.00
      }
    ],
    "shipping_address": "123, MG Road, Bangalore",
    "shipping_city": "Bangalore",
    "shipping_state": "Karnataka",
    "shipping_pincode": "560001",
    "shipping_phone": "919876543210"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order_id": "o1234567-89ab-cdef-0123-456789abcdef",
    "order_number": "ORD-20250115-001",
    "customer_id": "c1234567-89ab-cdef-0123-456789abcdef",
    "subtotal": 1998.00,
    "tax_amount": 359.64,
    "shipping_fee": 50.00,
    "total_amount": 2407.64,
    "status": "pending",
    "payment_status": "pending",
    "payment_expires_at": "2025-01-15T10:30:00.000Z",
    "items": [
      {
        "order_item_id": "oi1234567-89ab-cdef-0123-456789abcdef",
        "product_name": "Premium Cotton T-Shirt",
        "variant_details": "Blue - Large",
        "quantity": 2,
        "price": 999.00,
        "subtotal": 1998.00
      }
    ],
    "created_at": "2025-01-15T10:15:00.000Z"
  }
}
```

**What Happens Internally:**

1. **Order Created:**
```sql
-- orders table
order_id: o1234567-89ab-cdef-0123-456789abcdef
order_number: ORD-20250115-001
customer_id: c1234567-89ab-cdef-0123-456789abcdef
subtotal: 1998.00
tax_amount: 359.64
shipping_fee: 50.00
total_amount: 2407.64
status: pending
payment_status: pending
payment_expires_at: 2025-01-15 10:30:00
created_at: 2025-01-15 10:15:00
```

2. **Order Items Created:**
```sql
-- order_items table
order_item_id: oi1234567-89ab-cdef-0123-456789abcdef
order_id: o1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
variant_id: v1234567-89ab-cdef-0123-456789abcdef
quantity: 2
price: 999.00
subtotal: 1998.00
product_snapshot: {"name": "Premium Cotton T-Shirt", "sku": "TSHIRT-BLUE-L"}
```

3. **Stock Reserved (NOT deducted yet!):**
```sql
-- product_variants table (BEFORE)
stock_quantity: 50
reserved_stock: 5
version: 10

-- product_variants table (AFTER - using optimistic locking)
stock_quantity: 50  -- NOT changed yet!
reserved_stock: 7   -- Increased by 2
version: 11         -- Incremented

-- stock_reservations table (NEW RECORD)
reservation_id: r1234567-89ab-cdef-0123-456789abcdef
order_id: o1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
variant_id: v1234567-89ab-cdef-0123-456789abcdef
quantity: 2
reserved_at: 2025-01-15 10:15:00
expires_at: 2025-01-15 10:30:00  -- 15 minutes from now
status: active
```

**Available Stock Calculation:**
```
Available Stock = stock_quantity - reserved_stock
                = 50 - 7
                = 43 T-shirts available for other customers
```

---

## Step 4: Create Payment

### API: POST /payments

**Customer proceeds to checkout, backend creates Razorpay order**

```bash
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "550e8400-e29b-41d4-a716-446655440001",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "order_id": "o1234567-89ab-cdef-0123-456789abcdef",
    "customer_id": "c1234567-89ab-cdef-0123-456789abcdef",
    "amount": 2407.64,
    "currency": "INR",
    "receipt": "ORD-20250115-001",
    "notes": {
      "customer_name": "Rahul Sharma",
      "customer_phone": "919876543210"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "payment_id": "pay123-45ab-cdef-0123-456789abcdef",
    "razorpay_order_id": "order_M1AbCdEfGhIjKl",
    "amount": 2407.64,
    "currency": "INR",
    "status": "created"
  }
}
```

**Database Record:**
```sql
-- payments table
payment_id: pay123-45ab-cdef-0123-456789abcdef
business_id: 550e8400-e29b-41d4-a716-446655440001
order_id: o1234567-89ab-cdef-0123-456789abcdef
customer_id: c1234567-89ab-cdef-0123-456789abcdef
razorpay_order_id: order_M1AbCdEfGhIjKl
razorpay_payment_id: NULL  -- Will be filled after payment
razorpay_signature: NULL   -- Will be filled after payment
amount: 2407.64
currency: INR
status: created
method: NULL  -- Will be filled after payment
webhook_attempts: 0
refund_amount: 0.00
created_at: 2025-01-15 10:16:00
```

---

## Step 5: Customer Pays (Frontend - Razorpay Checkout)

**This happens on frontend using Razorpay Checkout**

```javascript
// Frontend code (React/HTML)
const options = {
  key: 'rzp_test_xxxxxxxxxxxx',
  amount: 240764, // Amount in paise (₹2407.64 = 240764 paise)
  currency: 'INR',
  order_id: 'order_M1AbCdEfGhIjKl',
  name: 'Your Business Name',
  description: 'Premium Cotton T-Shirt - Blue Large x 2',
  handler: async function (response) {
    // This function is called after successful payment
    console.log('Payment Response:', response);

    // response contains:
    // {
    //   razorpay_order_id: "order_M1AbCdEfGhIjKl",
    //   razorpay_payment_id: "pay_N2BcDeFgHiJkLm",
    //   razorpay_signature: "a1b2c3d4e5f6g7h8i9j0..."
    // }

    // Send to backend for verification
    await verifyPayment(response);
  },
  prefill: {
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    contact: '919876543210'
  },
  theme: {
    color: '#3399cc'
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

**Customer Actions:**
1. Selects payment method (UPI/Card/NetBanking)
2. Completes payment
3. Razorpay returns payment details to frontend

---

## Step 6: Verify Payment Signature

### API: POST /payments/verify

**Frontend sends payment details to backend for verification**

```bash
curl -X POST http://localhost:3000/payments/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_M1AbCdEfGhIjKl",
    "razorpay_payment_id": "pay_N2BcDeFgHiJkLm",
    "razorpay_signature": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
  }'
```

**Backend Verification Process:**
```typescript
// Generate expected signature
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update('order_M1AbCdEfGhIjKl|pay_N2BcDeFgHiJkLm')
  .digest('hex');

// Compare with received signature
if (expectedSignature === razorpay_signature) {
  // ✓ Signature valid - payment authentic
} else {
  // ✗ Signature invalid - possible tampering
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment_id": "pay123-45ab-cdef-0123-456789abcdef",
    "status": "authorized",
    "order_id": "o1234567-89ab-cdef-0123-456789abcdef"
  }
}
```

**Database Update:**
```sql
-- payments table (UPDATED)
payment_id: pay123-45ab-cdef-0123-456789abcdef
razorpay_payment_id: pay_N2BcDeFgHiJkLm  -- ADDED
razorpay_signature: a1b2c3d4e5f6g7h8... -- ADDED
status: authorized  -- CHANGED from 'created'
authorized_at: 2025-01-15 10:17:30  -- ADDED
```

---

## Step 7: Razorpay Webhook (Automatic)

### API: POST /payments/webhook

**Razorpay automatically sends webhook to our server**

```bash
# This is sent by Razorpay (not by us)
curl -X POST http://localhost:3000/payments/webhook \
  -H "x-razorpay-signature: webhook_signature_from_razorpay" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "account_id": "acc_xxxxxxxxxxxxx",
    "created_at": 1642234567,
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_N2BcDeFgHiJkLm",
          "order_id": "order_M1AbCdEfGhIjKl",
          "amount": 240764,
          "currency": "INR",
          "status": "captured",
          "method": "upi",
          "captured": true,
          "email": "rahul.sharma@example.com",
          "contact": "919876543210",
          "fee": 4815,
          "tax": 735,
          "created_at": 1642234500
        }
      }
    }
  }'
```

**Backend Webhook Processing:**

1. **Verify Webhook Signature:**
```typescript
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(webhookBody)
  .digest('hex');

if (expectedSignature !== receivedSignature) {
  throw new Error('Invalid webhook signature');
}
```

2. **Check for Duplicate (Idempotency):**
```sql
-- Check if webhook already processed
SELECT * FROM payment_webhooks
WHERE razorpay_event_id = 'payment.captured_pay_N2BcDeFgHiJkLm_1642234567';

-- If exists, return success without reprocessing
```

3. **Save Webhook Record:**
```sql
-- payment_webhooks table (NEW RECORD)
webhook_id: w1234567-89ab-cdef-0123-456789abcdef
payment_id: pay123-45ab-cdef-0123-456789abcdef
event_type: payment.captured
razorpay_event_id: payment.captured_pay_N2BcDeFgHiJkLm_1642234567
payload: { "event": "payment.captured", ... }  -- Full JSON
signature: webhook_signature_from_razorpay
status: processing
retry_count: 0
received_at: 2025-01-15 10:17:35
```

4. **Update Payment Status:**
```sql
-- payments table (UPDATED)
status: captured  -- CHANGED from 'authorized'
method: upi       -- ADDED
captured_at: 2025-01-15 10:17:35  -- ADDED
webhook_received_at: 2025-01-15 10:17:35  -- ADDED
webhook_processed_at: 2025-01-15 10:17:36  -- ADDED
webhook_attempts: 1  -- INCREMENTED
```

5. **Confirm Order Payment:**
```sql
-- orders table (UPDATED)
payment_status: paid  -- CHANGED from 'pending'
status: paid          -- CHANGED from 'pending'
paid_at: 2025-01-15 10:17:36
payment_expires_at: NULL  -- CLEARED
```

6. **Convert Stock Reservation to Sale:**
```sql
-- stock_reservations table (UPDATED)
status: converted  -- CHANGED from 'active'

-- product_variants table (FINAL UPDATE)
stock_quantity: 48  -- DEDUCTED (50 - 2)
reserved_stock: 5   -- RELEASED (7 - 2)
version: 12         -- INCREMENTED

-- in_stock status check
in_stock: TRUE  -- (48 > 0)
```

7. **Update Customer Stats:**
```sql
-- customers table (UPDATED)
total_orders: 1     -- INCREMENTED
total_spent: 2407.64  -- ADDED
last_order_date: 2025-01-15 10:17:36  -- UPDATED
engagement_score: 15  -- INCREASED (payment completed)
```

8. **Update Webhook Status:**
```sql
-- payment_webhooks table (UPDATED)
status: processed  -- CHANGED from 'processing'
processed_at: 2025-01-15 10:17:36  -- ADDED
```

**Response to Razorpay:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## Final Database State

After complete order and payment flow:

### 1. Customer Record
```sql
SELECT * FROM customers WHERE customer_id = 'c1234567-89ab-cdef-0123-456789abcdef';
```
```
customer_id: c1234567-89ab-cdef-0123-456789abcdef
name: Rahul Sharma
phone: 919876543210
email: rahul.sharma@example.com
total_orders: 1          ← Incremented
total_spent: 2407.64     ← Updated
last_order_date: 2025-01-15 10:17:36  ← Updated
engagement_score: 15     ← Increased
```

### 2. Order Record
```sql
SELECT * FROM orders WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';
```
```
order_id: o1234567-89ab-cdef-0123-456789abcdef
order_number: ORD-20250115-001
customer_id: c1234567-89ab-cdef-0123-456789abcdef
total_amount: 2407.64
status: paid             ← Final status
payment_status: paid     ← Final status
paid_at: 2025-01-15 10:17:36
payment_expires_at: NULL
```

### 3. Order Items
```sql
SELECT * FROM order_items WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';
```
```
order_item_id: oi1234567-89ab-cdef-0123-456789abcdef
order_id: o1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
variant_id: v1234567-89ab-cdef-0123-456789abcdef
quantity: 2
price: 999.00
subtotal: 1998.00
```

### 4. Payment Record
```sql
SELECT * FROM payments WHERE payment_id = 'pay123-45ab-cdef-0123-456789abcdef';
```
```
payment_id: pay123-45ab-cdef-0123-456789abcdef
order_id: o1234567-89ab-cdef-0123-456789abcdef
razorpay_order_id: order_M1AbCdEfGhIjKl
razorpay_payment_id: pay_N2BcDeFgHiJkLm
razorpay_signature: a1b2c3d4e5f6g7h8...
amount: 2407.64
currency: INR
status: captured         ← Final status
method: upi
authorized_at: 2025-01-15 10:17:30
captured_at: 2025-01-15 10:17:35
webhook_processed_at: 2025-01-15 10:17:36
refund_amount: 0.00
```

### 5. Stock Reservation
```sql
SELECT * FROM stock_reservations WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';
```
```
reservation_id: r1234567-89ab-cdef-0123-456789abcdef
order_id: o1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
variant_id: v1234567-89ab-cdef-0123-456789abcdef
quantity: 2
reserved_at: 2025-01-15 10:15:00
expires_at: 2025-01-15 10:30:00
status: converted        ← Final status (converted to sale)
```

### 6. Product Stock
```sql
SELECT * FROM product_variants WHERE variant_id = 'v1234567-89ab-cdef-0123-456789abcdef';
```
```
variant_id: v1234567-89ab-cdef-0123-456789abcdef
product_id: p1234567-89ab-cdef-0123-456789abcdef
sku: TSHIRT-BLUE-L
stock_quantity: 48       ← Deducted (50 - 2)
reserved_stock: 5        ← Back to normal (7 - 2)
in_stock: TRUE
version: 12              ← Incremented for concurrency control
```

### 7. Webhook Audit Trail
```sql
SELECT * FROM payment_webhooks WHERE payment_id = 'pay123-45ab-cdef-0123-456789abcdef';
```
```
webhook_id: w1234567-89ab-cdef-0123-456789abcdef
payment_id: pay123-45ab-cdef-0123-456789abcdef
event_type: payment.captured
razorpay_event_id: payment.captured_pay_N2BcDeFgHiJkLm_1642234567
payload: {...}           ← Full webhook JSON
status: processed        ← Successfully processed
retry_count: 0
received_at: 2025-01-15 10:17:35
processed_at: 2025-01-15 10:17:36
```

---

## Alternative Scenarios

### Scenario A: Payment Timeout (Customer doesn't pay)

**What happens:**

**After 15 minutes (10:30:00):**

Background cleanup job runs:
```sql
-- Find expired reservations
SELECT * FROM stock_reservations
WHERE status = 'active'
  AND expires_at < NOW();

-- Release reservation
UPDATE stock_reservations
SET status = 'expired'
WHERE reservation_id = 'r1234567-89ab-cdef-0123-456789abcdef';

-- Release reserved stock
UPDATE product_variants
SET reserved_stock = reserved_stock - 2
WHERE variant_id = 'v1234567-89ab-cdef-0123-456789abcdef';
-- reserved_stock goes from 7 back to 5

-- Cancel order
UPDATE orders
SET status = 'cancelled',
    cancelled_at = NOW(),
    admin_notes = 'Payment timeout - auto-cancelled'
WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';
```

**Final State:**
- Order: `cancelled`
- Payment: `created` (never progressed)
- Stock: Released (available for other customers)
- Customer: No charges, can reorder

---

### Scenario B: Payment Failed

**Razorpay webhook: `payment.failed`**

```json
{
  "event": "payment.failed",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_N2BcDeFgHiJkLm",
        "status": "failed",
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": "Payment failed due to insufficient balance"
      }
    }
  }
}
```

**Backend Processing:**
```sql
-- Update payment
UPDATE payments
SET status = 'failed',
    failed_at = NOW(),
    failure_reason = 'BAD_REQUEST_ERROR: Payment failed due to insufficient balance'
WHERE payment_id = 'pay123-45ab-cdef-0123-456789abcdef';

-- Release stock reservation immediately
UPDATE stock_reservations
SET status = 'expired'
WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';

UPDATE product_variants
SET reserved_stock = reserved_stock - 2;

-- Cancel order
UPDATE orders
SET status = 'cancelled',
    cancelled_at = NOW()
WHERE order_id = 'o1234567-89ab-cdef-0123-456789abcdef';
```

---

### Scenario C: Refund Request

**Customer requests refund after 2 days**

#### API: POST /payments/:id/refund

**Full Refund:**
```bash
curl -X POST http://localhost:3000/payments/pay123-45ab-cdef-0123-456789abcdef/refund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer not satisfied with quality",
    "notes": {
      "requested_by": "customer",
      "refund_type": "quality_issue"
    }
  }'
```

**Partial Refund (₹1000):**
```bash
curl -X POST http://localhost:3000/payments/pay123-45ab-cdef-0123-456789abcdef/refund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000.00,
    "reason": "One item damaged",
    "notes": {
      "requested_by": "admin"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Partial refund of ₹1000 created successfully",
  "data": {
    "payment_id": "pay123-45ab-cdef-0123-456789abcdef",
    "refund_amount": 1000.00,
    "status": "partial_refund"
  }
}
```

**Razorpay Refund API Call:**
```typescript
// Backend calls Razorpay
const refund = await razorpay.payments.refund('pay_N2BcDeFgHiJkLm', {
  amount: 100000, // ₹1000 in paise
  notes: { reason: 'One item damaged' }
});
```

**Database Update:**
```sql
-- payments table
UPDATE payments
SET status = 'partial_refund',
    refund_amount = 1000.00,
    refunded_at = NOW(),
    refund_reason = 'One item damaged'
WHERE payment_id = 'pay123-45ab-cdef-0123-456789abcdef';
```

**Razorpay Webhook: `refund.processed`**
```json
{
  "event": "refund.processed",
  "payload": {
    "refund": {
      "entity": {
        "id": "rfnd_XyZaBcDeFgHiJk",
        "payment_id": "pay_N2BcDeFgHiJkLm",
        "amount": 100000,
        "status": "processed"
      }
    }
  }
}
```

---

## Complete API Reference

### Customer APIs

#### 1. Create Customer
```bash
POST /customers
Authorization: Bearer {token}

Body: {
  "business_id": "uuid",
  "tenant_id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string",
  "whatsapp_number": "string"
}
```

#### 2. Find or Create Customer (WhatsApp Integration)
```bash
POST /customers/find-or-create
Authorization: Bearer {token}

Body: {
  "business_id": "uuid",
  "tenant_id": "uuid",
  "phone": "919876543210",
  "name": "Rahul Sharma",
  "whatsapp_number": "919876543210"
}
```

#### 3. Bulk Create Customers (CSV Import)
```bash
POST /customers/bulk
Authorization: Bearer {token}

Body: {
  "business_id": "uuid",
  "tenant_id": "uuid",
  "customers": [
    {
      "name": "Customer 1",
      "phone": "919876543211",
      "email": "customer1@example.com"
    },
    ...
  ]
}
```

#### 4. Get All Customers
```bash
GET /customers?business_id={uuid}&page=1&limit=20&sort_by=created_at&order=desc
Authorization: Bearer {token}
```

#### 5. Get Customer by ID
```bash
GET /customers/{id}
Authorization: Bearer {token}
```

#### 6. Get Top Customers (VIP)
```bash
GET /customers/top?business_id={uuid}&limit=10&sort_by=total_spent
Authorization: Bearer {token}
```

#### 7. Get Customer Segments
```bash
GET /customers/segments?business_id={uuid}
Authorization: Bearer {token}
```

#### 8. Update Customer
```bash
PUT /customers/{id}
Authorization: Bearer {token}

Body: {
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

#### 9. Update Engagement Score
```bash
PATCH /customers/{id}/engagement
Authorization: Bearer {token}

Body: {
  "delta": 5
}
```

#### 10. Delete Customer
```bash
DELETE /customers/{id}
Authorization: Bearer {token}
```

---

### Order APIs

#### 1. Create Order
```bash
POST /orders
Authorization: Bearer {token}

Body: {
  "business_id": "uuid",
  "tenant_id": "uuid",
  "customer_id": "uuid",
  "order_type": "product",
  "source": "whatsapp",
  "items": [
    {
      "product_id": "uuid",
      "variant_id": "uuid",
      "quantity": 2,
      "price": 999.00
    }
  ],
  "shipping_address": "123, MG Road",
  "shipping_city": "Bangalore",
  "shipping_state": "Karnataka",
  "shipping_pincode": "560001",
  "shipping_phone": "919876543210"
}
```

#### 2. Get All Orders
```bash
GET /orders?business_id={uuid}&status=pending&page=1&limit=20
Authorization: Bearer {token}
```

#### 3. Get Order by ID
```bash
GET /orders/{id}
Authorization: Bearer {token}
```

#### 4. Update Order Status
```bash
PATCH /orders/{id}/status
Authorization: Bearer {token}

Body: {
  "status": "processing"
}
```

#### 5. Confirm Payment
```bash
PATCH /orders/{id}/payment
Authorization: Bearer {token}

Body: {
  "payment_id": "razorpay_payment_id",
  "payment_method": "upi"
}
```

#### 6. Ship Order
```bash
PATCH /orders/{id}/ship
Authorization: Bearer {token}

Body: {
  "tracking_number": "TRACK123456"
}
```

#### 7. Deliver Order
```bash
PATCH /orders/{id}/deliver
Authorization: Bearer {token}
```

#### 8. Cancel Order
```bash
DELETE /orders/{id}
Authorization: Bearer {token}

Body: {
  "reason": "Customer requested cancellation"
}
```

---

### Payment APIs

#### 1. Create Payment
```bash
POST /payments
Authorization: Bearer {token}

Body: {
  "business_id": "uuid",
  "tenant_id": "uuid",
  "order_id": "uuid",
  "customer_id": "uuid",
  "amount": 2407.64,
  "currency": "INR"
}
```

#### 2. Verify Payment Signature
```bash
POST /payments/verify
Authorization: Bearer {token}

Body: {
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_hash"
}
```

#### 3. Razorpay Webhook
```bash
POST /payments/webhook
Headers: x-razorpay-signature: {signature}

Body: {
  "event": "payment.captured",
  "payload": {...}
}
```

#### 4. Capture Payment Manually
```bash
POST /payments/{id}/capture
Authorization: Bearer {token}
```

#### 5. Create Refund
```bash
POST /payments/{id}/refund
Authorization: Bearer {token}

Body: {
  "amount": 1000.00,  // Optional: omit for full refund
  "reason": "Quality issue"
}
```

#### 6. Get All Payments
```bash
GET /payments?business_id={uuid}&status=captured&page=1&limit=20
Authorization: Bearer {token}
```

#### 7. Get Payment by ID
```bash
GET /payments/{id}
Authorization: Bearer {token}
```

#### 8. Get Payment by Order ID
```bash
GET /payments/order/{orderId}
Authorization: Bearer {token}
```

#### 9. Get Payment Analytics
```bash
GET /payments/analytics?business_id={uuid}&from_date=2025-01-01&to_date=2025-01-31
Authorization: Bearer {token}
```

---

## Testing Checklist

### ✅ Customers Module
- [ ] Create customer
- [ ] Find or create (duplicate prevention)
- [ ] Bulk upload customers
- [ ] Get customers with filters
- [ ] Get top customers
- [ ] Get customer segments
- [ ] Update customer
- [ ] Update engagement score
- [ ] Delete customer

### ✅ Orders Module
- [ ] Create order (stock reserved)
- [ ] Check stock is reserved (not deducted)
- [ ] Get orders with filters
- [ ] Update order status
- [ ] Confirm payment (stock deducted)
- [ ] Ship order
- [ ] Deliver order
- [ ] Cancel order (stock released)
- [ ] Test payment timeout (15 minutes)
- [ ] Test concurrent orders (race condition prevention)

### ✅ Payments Module
- [ ] Create payment (Razorpay order)
- [ ] Verify signature
- [ ] Process webhook (payment.captured)
- [ ] Webhook idempotency (duplicate prevention)
- [ ] Create full refund
- [ ] Create partial refund
- [ ] Get payment analytics
- [ ] Test invalid signature (security)
- [ ] Test concurrent payments

---

## Production Readiness Checklist

### Database
- [ ] Run migrations: `npx prisma db push`
- [ ] Verify all tables created
- [ ] Check indexes are created
- [ ] Test database connection

### Environment
- [ ] Set DATABASE_URL
- [ ] Set JWT_SECRET
- [ ] Set RAZORPAY_KEY_ID (test/live)
- [ ] Set RAZORPAY_KEY_SECRET
- [ ] Set RAZORPAY_WEBHOOK_SECRET

### Razorpay Setup
- [ ] Create Razorpay account
- [ ] Generate API keys
- [ ] Configure webhook URL
- [ ] Test webhook delivery
- [ ] Switch to live mode

### Testing
- [ ] Test all customer APIs
- [ ] Test all order APIs
- [ ] Test all payment APIs
- [ ] Test complete E-commerce flow
- [ ] Test refund flow
- [ ] Test timeout scenarios
- [ ] Test error cases

---

## Support

For issues:
- Check logs: `tail -f logs/app.log`
- Check database: `psql -U postgres -d biznavigate`
- Check Razorpay Dashboard: https://dashboard.razorpay.com
- Review PAYMENT_INTEGRATION_GUIDE.md
- Review PRODUCTION_READY_ORDER_SYSTEM.md
