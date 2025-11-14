# Complete E-Commerce Flow Summary

## 🎯 Overview

This document provides a bird's-eye view of the complete e-commerce system with Customers, Orders, and Payments modules.

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WhatsApp Customer                         │
│                   (Browses products via catalog)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: Customer Creation                     │
│  POST /customers/find-or-create                                  │
│  • Auto-creates customer on first WhatsApp message               │
│  • Stores: name, phone, email, whatsapp_number                   │
│  • Prevents duplicates (unique phone per business)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 2: Browse Products                       │
│  GET /products?business_id={uuid}                                │
│  • Customer views product catalog                                │
│  • Checks stock availability                                     │
│  • Selects product + variant (color, size, etc.)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 3: Create Order (PENDING)                   │
│  POST /orders                                                    │
│  ✓ Order Status: PENDING                                         │
│  ✓ Payment Status: PENDING                                       │
│  ✓ Stock: RESERVED (not deducted!)                               │
│  ✓ Payment Expires: 15 minutes                                   │
│                                                                   │
│  Database Changes:                                                │
│  • orders table: New record (status=pending)                     │
│  • order_items table: Line items with product snapshot           │
│  • stock_reservations table: Active reservation                  │
│  • product_variants: reserved_stock += quantity                  │
│  • product_variants: stock_quantity UNCHANGED                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               STEP 4: Create Payment (Razorpay)                  │
│  POST /payments                                                  │
│  ✓ Creates Razorpay order                                        │
│  ✓ Returns razorpay_order_id                                     │
│  ✓ Payment Status: CREATED                                       │
│                                                                   │
│  Database Changes:                                                │
│  • payments table: New record (status=created)                   │
│  • razorpay_order_id stored                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│          STEP 5: Customer Pays (Razorpay Checkout)               │
│  Frontend: Razorpay.checkout({...})                              │
│  • Customer selects payment method (UPI/Card/NetBanking)         │
│  • Enters payment details                                        │
│  • Razorpay processes payment                                    │
│  • Returns: razorpay_payment_id + signature                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 6: Verify Signature (Frontend → Backend)            │
│  POST /payments/verify                                           │
│  ✓ Backend verifies HMAC SHA256 signature                        │
│  ✓ Prevents payment tampering                                    │
│  ✓ Payment Status: AUTHORIZED                                    │
│                                                                   │
│  Database Changes:                                                │
│  • payments: status=authorized, authorized_at=NOW()              │
│  • payments: razorpay_payment_id + signature saved               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│       STEP 7: Webhook - payment.captured (Razorpay → Us)         │
│  POST /payments/webhook                                          │
│  ✓ Razorpay sends confirmation                                   │
│  ✓ Signature verified                                            │
│  ✓ Idempotency check (prevent duplicate processing)              │
│  ✓ Payment Status: CAPTURED                                      │
│                                                                   │
│  CRITICAL ACTIONS:                                                │
│  1. Update Payment:                                               │
│     • status = captured                                           │
│     • method = upi/card/netbanking                                │
│     • captured_at = NOW()                                         │
│                                                                   │
│  2. Confirm Order Payment:                                        │
│     • order.payment_status = paid                                 │
│     • order.status = paid                                         │
│     • order.paid_at = NOW()                                       │
│                                                                   │
│  3. Convert Stock Reservation → Sale:                             │
│     • stock_reservations.status = converted                       │
│     • product_variants.stock_quantity -= quantity                 │
│     • product_variants.reserved_stock -= quantity                 │
│                                                                   │
│  4. Update Customer Stats:                                        │
│     • customers.total_orders += 1                                 │
│     • customers.total_spent += amount                             │
│     • customers.last_order_date = NOW()                           │
│     • customers.engagement_score += 5                             │
│                                                                   │
│  5. Create Audit Trail:                                           │
│     • payment_webhooks: Full webhook logged                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STEP 8: Order Fulfillment                      │
│  PATCH /orders/{id}/status → "processing"                        │
│  PATCH /orders/{id}/ship → Add tracking number                   │
│  PATCH /orders/{id}/deliver → Mark delivered                     │
│                                                                   │
│  Order Journey:                                                   │
│  pending → paid → processing → shipped → delivered               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Alternative Flows

### ❌ Scenario A: Payment Timeout (Customer Doesn't Pay)

```
Customer creates order → Stock reserved → 15 minutes pass → No payment

Background Job (every 5 minutes):
┌────────────────────────────────────────────────┐
│  1. Find expired reservations                   │
│     WHERE expires_at < NOW() AND status=active  │
│                                                 │
│  2. Release Stock:                              │
│     • stock_reservations.status = expired       │
│     • reserved_stock -= quantity                │
│     • Stock available again!                    │
│                                                 │
│  3. Cancel Order:                               │
│     • order.status = cancelled                  │
│     • order.admin_notes = "Payment timeout"     │
│                                                 │
│  Result: Stock freed, customer can retry        │
└────────────────────────────────────────────────┘
```

### ❌ Scenario B: Payment Failed

```
Razorpay Webhook: payment.failed
┌────────────────────────────────────────────────┐
│  1. Update Payment:                             │
│     • status = failed                           │
│     • failure_reason = error message            │
│                                                 │
│  2. Release Stock Immediately:                  │
│     • stock_reservations.status = expired       │
│     • reserved_stock -= quantity                │
│                                                 │
│  3. Cancel Order:                               │
│     • order.status = cancelled                  │
│                                                 │
│  Result: Stock freed immediately                │
└────────────────────────────────────────────────┘
```

### 💰 Scenario C: Refund Request

```
Customer requests refund after delivery

POST /payments/{id}/refund
┌────────────────────────────────────────────────┐
│  1. Create Refund in Razorpay:                  │
│     • Full refund OR partial refund             │
│     • Razorpay processes (2-7 days)             │
│                                                 │
│  2. Update Payment:                             │
│     • status = refunded/partial_refund          │
│     • refund_amount = amount                    │
│     • refunded_at = NOW()                       │
│                                                 │
│  3. Webhook: refund.processed                   │
│     • Confirms refund complete                  │
│                                                 │
│  Note: Stock NOT restocked (already consumed)   │
└────────────────────────────────────────────────┘
```

---

## 🏁 Race Condition Prevention

### Problem: 2 Customers Order Last Item Simultaneously

```
Initial: 1 T-shirt in stock
Customer A: Clicks "Buy" (10:00:00.000)
Customer B: Clicks "Buy" (10:00:00.005)  ← 5ms later
```

### Without Optimistic Locking (BROKEN):
```
Time    Customer A                 Customer B                 Stock
0ms     Read: stock=1              -                          1
5ms     -                          Read: stock=1              1
10ms    Check: 1 >= 1 ✓            -                          1
15ms    -                          Check: 1 >= 1 ✓            1
20ms    UPDATE stock=0             -                          0
25ms    -                          UPDATE stock=-1            -1  ❌ OVERSOLD!
```

### With Optimistic Locking (FIXED):
```
Time    Customer A                 Customer B                 Stock  Version
0ms     Read: stock=1, v=5         -                          1      5
5ms     -                          Read: stock=1, v=5         1      5
10ms    Check: 1 >= 1 ✓            -                          1      5
15ms    -                          Check: 1 >= 1 ✓            1      5
20ms    UPDATE WHERE v=5 ✓         -                          0      6
25ms    -                          UPDATE WHERE v=5 ❌         0      6
30ms    Success!                   -                          0      6
35ms    -                          Version mismatch!          0      6
40ms    -                          Retry: Read v=6            0      6
45ms    -                          Check: 0 >= 1 ❌            0      6
50ms    -                          Error: Out of stock        0      6

Result: Customer A gets item, Customer B receives "Out of stock" error ✓
```

---

## 📦 Database Schema Overview

### Core Tables

#### 1. **customers**
```sql
customer_id UUID PRIMARY KEY
business_id UUID
tenant_id UUID
name VARCHAR(255)
phone VARCHAR(20) UNIQUE
email VARCHAR(255)
whatsapp_number VARCHAR(20)
total_orders INT DEFAULT 0
total_spent DECIMAL(10,2) DEFAULT 0
last_order_date TIMESTAMP
engagement_score INT DEFAULT 10
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 2. **orders**
```sql
order_id UUID PRIMARY KEY
business_id UUID
tenant_id UUID
customer_id UUID
order_number VARCHAR(50)  -- ORD-20250115-001
order_type VARCHAR(50)    -- product/service/course
subtotal DECIMAL(10,2)
tax_amount DECIMAL(10,2)
shipping_fee DECIMAL(10,2)
total_amount DECIMAL(10,2)
status VARCHAR(20)         -- pending/paid/processing/shipped/delivered/cancelled
payment_status VARCHAR(20) -- pending/paid
payment_expires_at TIMESTAMP -- 15 minutes timeout
shipping_address TEXT
shipping_city VARCHAR(100)
shipping_state VARCHAR(100)
shipping_pincode VARCHAR(20)
created_at TIMESTAMP
paid_at TIMESTAMP
shipped_at TIMESTAMP
delivered_at TIMESTAMP
cancelled_at TIMESTAMP
```

#### 3. **order_items**
```sql
order_item_id UUID PRIMARY KEY
order_id UUID
product_id UUID
variant_id UUID
quantity INT
price DECIMAL(10,2)
subtotal DECIMAL(10,2)
product_snapshot JSON  -- Stores product details at time of order
```

#### 4. **stock_reservations**
```sql
reservation_id UUID PRIMARY KEY
order_id UUID UNIQUE
product_id UUID
variant_id UUID
quantity INT
reserved_at TIMESTAMP
expires_at TIMESTAMP     -- 15 minutes from reserved_at
status VARCHAR(20)        -- active/converted/expired/cancelled
```

#### 5. **payments**
```sql
payment_id UUID PRIMARY KEY
business_id UUID
order_id UUID
customer_id UUID
razorpay_order_id VARCHAR(255) UNIQUE
razorpay_payment_id VARCHAR(255) UNIQUE
razorpay_signature VARCHAR(500)
amount DECIMAL(10,2)
currency VARCHAR(3)
status VARCHAR(50)        -- created/authorized/captured/failed/refunded
method VARCHAR(50)        -- card/netbanking/wallet/upi
webhook_received_at TIMESTAMP
webhook_processed_at TIMESTAMP
webhook_attempts INT
refund_amount DECIMAL(10,2) DEFAULT 0
refunded_at TIMESTAMP
refund_reason TEXT
authorized_at TIMESTAMP
captured_at TIMESTAMP
failed_at TIMESTAMP
failure_reason TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 6. **payment_webhooks**
```sql
webhook_id UUID PRIMARY KEY
payment_id UUID
event_type VARCHAR(100)   -- payment.authorized/captured/failed
razorpay_event_id VARCHAR(255) UNIQUE  -- For idempotency
payload JSONB             -- Full webhook body
signature VARCHAR(500)
status VARCHAR(50)        -- pending/processed/failed/duplicate
retry_count INT DEFAULT 0
received_at TIMESTAMP
processed_at TIMESTAMP
```

#### 7. **payment_reconciliation**
```sql
reconciliation_id UUID PRIMARY KEY
business_id UUID
settlement_date DATE
total_payments INT
total_amount DECIMAL(10,2)
total_fees DECIMAL(10,2)
net_amount DECIMAL(10,2)
status VARCHAR(50)        -- pending/matched/discrepancy/resolved
discrepancy_count INT
```

---

## 🔐 Security Features

### 1. Payment Signature Verification
```typescript
// Payment Signature (after customer pays)
const expected = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(`${order_id}|${payment_id}`)
  .digest('hex');

if (expected !== received_signature) {
  throw Error('Invalid signature - possible tampering');
}
```

### 2. Webhook Signature Verification
```typescript
// Webhook Signature (Razorpay → Our Server)
const expected = crypto
  .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
  .update(webhookBody)
  .digest('hex');

if (expected !== received_signature) {
  throw Error('Invalid webhook - possible fake request');
}
```

### 3. Idempotency (Prevent Duplicate Processing)
```typescript
// Check if webhook already processed
const existing = await findWebhookByEventId(razorpay_event_id);
if (existing) {
  return { success: true, message: 'Already processed' };
}
// Process webhook...
```

### 4. Optimistic Locking (Race Condition Prevention)
```typescript
// Atomic update with version check
const result = await db.updateMany({
  where: {
    product_id,
    version: currentVersion, // Must match!
  },
  data: {
    reserved_stock: { increment: quantity },
    version: { increment: 1 },
  },
});

if (result.count === 0) {
  // Version changed by another process
  throw ConflictException('Stock updated by another process');
}
```

---

## 📈 Performance Features

### 1. Database Indexes
```sql
-- Fast payment lookups
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Fast order lookups
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Fast stock reservation lookups
CREATE INDEX idx_reservations_expires_at ON stock_reservations(expires_at)
  WHERE status = 'active';
```

### 2. Parallel Database Queries
```typescript
// Fetch orders and total count in parallel
const [orders, total] = await Promise.all([
  prisma.orders.findMany({ where, skip, take }),
  prisma.orders.count({ where }),
]);
```

### 3. Background Job (Stock Release)
```typescript
// Runs every 5 minutes via BullMQ
@Cron('*/5 * * * *')
async cleanupExpiredReservations() {
  const expired = await findExpiredReservations();
  for (const reservation of expired) {
    await releaseReservation(reservation.order_id);
  }
}
```

---

## 🎯 Success Metrics

### System Capabilities

✅ **Concurrent Users**: Handles thousands of simultaneous customers
✅ **Race Condition Prevention**: Optimistic locking with version control
✅ **Stock Management**: Two-phase (reserve → convert/release)
✅ **Payment Security**: HMAC SHA256 signature verification
✅ **Webhook Idempotency**: Prevents duplicate processing
✅ **Automatic Cleanup**: Background job releases expired stock
✅ **Complete Audit Trail**: All webhooks and events logged
✅ **Refund Support**: Full and partial refunds
✅ **Customer Tracking**: Total orders, spend, engagement score
✅ **Payment Analytics**: Revenue, success rate, method breakdown

---

## 🚀 Production Deployment

### Quick Start

1. **Setup Database:**
```bash
npx prisma db push
npx prisma generate
```

2. **Configure Environment:**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
JWT_SECRET=your-secret
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

3. **Start Server:**
```bash
npm run start:prod
```

4. **Configure Razorpay Webhook:**
- URL: `https://yourdomain.com/payments/webhook`
- Events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.created`

---

## 📚 Documentation

- **API Testing Guide**: [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)
- **Payment Integration**: [PAYMENT_INTEGRATION_GUIDE.md](PAYMENT_INTEGRATION_GUIDE.md)
- **Order System Details**: [PRODUCTION_READY_ORDER_SYSTEM.md](PRODUCTION_READY_ORDER_SYSTEM.md)

---

## 🎉 System Status: PRODUCTION READY!

All modules tested, documented, and ready for deployment with:
- ✅ Race condition prevention
- ✅ Payment security
- ✅ Stock management
- ✅ Automatic cleanup
- ✅ Complete audit trail
- ✅ Analytics and reporting

**The system can now handle thousands of concurrent customers safely!** 🚀
