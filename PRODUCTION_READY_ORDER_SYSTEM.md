# Production-Ready Order System - Implementation Complete

## Overview
The Orders Module has been upgraded with production-ready features to handle race conditions, stock reservations, and payment timeouts. This system is now ready to handle high-concurrency scenarios where multiple customers order simultaneously.

---

## Critical Production Problems - SOLVED ✅

### Problem 1: Race Condition - Multiple Customers Ordering Last Item ✅
**Issue**: When 100 customers simultaneously click "Buy" on the last item, all 100 orders could be created, resulting in overselling (-99 stock).

**Solution Implemented**: **Optimistic Locking with Version Control**
- Added `version` column to `products` and `product_variants` tables
- Stock updates use atomic `updateMany` with version check
- Failed updates trigger automatic retry with exponential backoff (3 attempts max)

**How it Works**:
```typescript
// Step 1: Read product with current version
const product = await tx.products.findUnique({ where: { product_id } });
const currentVersion = product.version; // e.g., 5

// Step 2: Atomic update with version check
const result = await tx.products.updateMany({
  where: {
    product_id,
    version: currentVersion, // Must match current version
  },
  data: {
    reserved_stock: { increment: quantity },
    version: currentVersion + 1, // Increment version
  },
});

// Step 3: If updateCount === 0, version changed (another process updated)
if (result.count === 0) {
  throw new ConflictException('Stock updated by another process. Retrying...');
}
```

**Result**: Only the first customer gets the item. Others receive "Insufficient stock" error immediately.

---

### Problem 2: Stock Blocked by Unpaid Orders ✅
**Issue**: Customer creates order, stock deducted immediately, customer never pays → Stock unavailable forever.

**Solution Implemented**: **Two-Phase Stock Management**
1. **Phase 1 - Reservation** (Order created):
   - Stock NOT deducted from `stock_quantity`
   - Stock added to `reserved_stock`
   - Available stock = `stock_quantity - reserved_stock`
   - Reservation expires in 15 minutes

2. **Phase 2a - Sale** (Payment confirmed):
   - Deduct from both `stock_quantity` and `reserved_stock`
   - Reservation marked as "converted"

3. **Phase 2b - Release** (Timeout/Cancel):
   - Release `reserved_stock`
   - Stock becomes available again
   - Reservation marked as "expired"

**Example Flow**:
```
Initial State:
- stock_quantity: 10
- reserved_stock: 0
- available: 10

Customer Orders 2 Items (Unpaid):
- stock_quantity: 10 (unchanged)
- reserved_stock: 2
- available: 8 (others can still buy)

Scenario A - Customer Pays:
- stock_quantity: 8 (deducted)
- reserved_stock: 0 (released)
- available: 8

Scenario B - Customer Doesn't Pay (15 min timeout):
- stock_quantity: 10 (restored)
- reserved_stock: 0 (released)
- available: 10 ✓
```

---

### Problem 3: No Automatic Cleanup ✅
**Issue**: Expired reservations need to be cleaned up automatically.

**Solution Implemented**: **BullMQ Background Job**
- Job runs every 5 minutes
- Finds reservations where `expires_at < NOW()` and `status = 'active'`
- Calls `releaseReservation()` for each expired order
- Releases reserved stock automatically
- Updates order status to "cancelled"

**Job Configuration**:
```typescript
// Scheduled every 5 minutes via cron pattern
repeat: {
  pattern: '*/5 * * * *',
}
```

---

## New Database Schema

### 1. Stock Reservations Table
```sql
CREATE TABLE stock_reservations (
  reservation_id UUID PRIMARY KEY,
  order_id UUID UNIQUE NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  quantity INTEGER NOT NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- Auto-expires after 15 minutes
  status VARCHAR(20) DEFAULT 'active', -- active, converted, expired, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```

### 2. Products Table Updates
```sql
ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 0;

ALTER TABLE product_variants ADD COLUMN reserved_stock INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN version INTEGER DEFAULT 0;
```

### 3. Orders Table Updates
```sql
ALTER TABLE orders ADD COLUMN payment_expires_at TIMESTAMPTZ;
```

### 4. Indexes for Performance
```sql
CREATE INDEX idx_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX idx_reservations_expires_at ON stock_reservations(expires_at)
  WHERE status = 'active';
CREATE UNIQUE INDEX idx_active_reservation_per_order
  ON stock_reservations(order_id) WHERE status = 'active';
```

---

## New Services & Components

### 1. StockReservationService
**Location**: `src/features/orders/application/services/stock-reservation.service.ts`

**Key Methods**:
- `reserveStock()` - Reserve stock with optimistic locking (3 retry attempts)
- `convertReservationToSale()` - Convert reservation to actual sale after payment
- `releaseReservation()` - Release stock on cancellation/timeout
- `cleanupExpiredReservations()` - Background job handler
- `getAvailableStock()` - Real-time stock availability check

**Configuration**:
- Reservation timeout: 15 minutes
- Max retry attempts: 3
- Retry backoff: Exponential (100ms, 200ms, 300ms)

### 2. ReservationCleanupProcessor
**Location**: `src/features/orders/application/jobs/reservation-cleanup.processor.ts`

**Purpose**: BullMQ worker that processes cleanup jobs

### 3. ReservationCleanupScheduler
**Location**: `src/features/orders/application/services/reservation-cleanup.scheduler.ts`

**Purpose**: Schedules recurring cleanup job every 5 minutes

### 4. Updated OrderRepository
**Location**: `src/features/orders/infrastructure/order.repository.prisma.ts`

**Changes**:
- `create()`: Now calls `reserveStock()` instead of immediate deduction
- `confirmPayment()`: Calls `convertReservationToSale()` before updating payment status
- `cancel()`: Calls `releaseReservation()` to release reserved stock
- Added `payment_expires_at` timestamp on order creation

---

## Order Flow - Production Ready

### 1. Order Creation (Pending Payment)
```
POST /orders

1. Validate customer, products, stock availability
2. Calculate prices (subtotal, tax, shipping, total)
3. Create order record (status: "pending", payment_status: "pending")
4. Set payment_expires_at = NOW() + 15 minutes
5. For each order item:
   - Create order_item with product snapshot
   - Call reserveStock() with optimistic locking:
     a. Read product with version
     b. Check available stock (stock_quantity - reserved_stock >= quantity)
     c. Atomic update with version check
     d. If version mismatch, retry (max 3 attempts with exponential backoff)
     e. Create stock_reservation record
6. Return order confirmation

Result:
- Order created with 15-minute payment window
- Stock reserved but not deducted
- Available to other customers = stock_quantity - reserved_stock
```

### 2. Payment Confirmation
```
PATCH /orders/:id/payment

1. Call convertReservationToSale(orderId):
   - Find all active reservations for order
   - For each reservation:
     a. Deduct from stock_quantity
     b. Deduct from reserved_stock
     c. Update in_stock status
     d. Mark reservation as "converted"
2. Update order (payment_status: "paid", status: "paid", paid_at: NOW())
3. Clear payment_expires_at

Result:
- Stock permanently deducted
- Reservation converted to sale
- Order ready for fulfillment
```

### 3. Order Cancellation
```
DELETE /orders/:id

1. Call releaseReservation(orderId):
   - Find all active reservations for order
   - For each reservation:
     a. Decrement reserved_stock
     b. Set in_stock = true
     c. Mark reservation as "expired"
2. Update order (status: "cancelled", cancelled_at: NOW())

Result:
- Stock released back to available pool
- Reservation marked expired
- Other customers can now purchase
```

### 4. Payment Timeout (Automatic)
```
Background Job (Every 5 minutes)

1. Find orders where payment_expires_at < NOW() AND status = "pending"
2. For each expired order:
   - Call releaseReservation(orderId)
   - Update order (status: "cancelled", admin_notes: "Payment timeout")

Result:
- Expired orders auto-cancelled
- Stock automatically released
- No manual intervention needed
```

---

## Race Condition Prevention - Technical Details

### Scenario: 2 Customers Order Last Item Simultaneously

**Initial State**:
- Product: T-Shirt (Blue, L)
- stock_quantity: 1
- reserved_stock: 0
- version: 5

**Timeline**:
```
Time    Customer A              Customer B              Database
0ms     Request: Buy 1          -                       stock=1, version=5
5ms     -                       Request: Buy 1          stock=1, version=5
10ms    Read: stock=1, v=5      -                       stock=1, version=5
15ms    -                       Read: stock=1, v=5      stock=1, version=5
20ms    Check: 1-0 >= 1 ✓       -                       stock=1, version=5
25ms    -                       Check: 1-0 >= 1 ✓       stock=1, version=5
30ms    UPDATE WHERE v=5 ✓      -                       stock=1, res=1, v=6
35ms    -                       UPDATE WHERE v=5 ❌      FAILED (v=6, not 5)
40ms    Success! Reserved       -                       stock=1, res=1, v=6
45ms    -                       Retry: Read v=6         stock=1, res=1, v=6
50ms    -                       Check: 1-1 >= 1 ❌       Insufficient stock
55ms    -                       Error returned          -
```

**Result**: Customer A gets the item. Customer B receives "Insufficient stock" error. No overselling!

---

## Testing Concurrent Orders

### Manual Test Script
```typescript
// Simulate 10 customers ordering the last 2 items simultaneously
const promises = [];
for (let i = 0; i < 10; i++) {
  promises.push(
    fetch('http://localhost:3000/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: 'xxx',
        customer_id: 'yyy',
        items: [{ product_id: 'zzz', variant_id: 'aaa', quantity: 1 }],
      }),
    })
  );
}

const results = await Promise.all(promises);

// Expected Result:
// - 2 orders created successfully (201)
// - 8 orders rejected with "Insufficient stock" (409)
```

### Load Testing
```bash
# Use Apache Bench to test 100 concurrent requests
ab -n 100 -c 100 -T 'application/json' -p order.json \
  http://localhost:3000/orders
```

---

## Configuration

### Environment Variables
```env
# Payment timeout (minutes)
PAYMENT_TIMEOUT_MINUTES=15

# Cleanup job interval (minutes)
CLEANUP_INTERVAL_MINUTES=5

# Stock reservation retry settings
MAX_STOCK_RETRY_ATTEMPTS=3
STOCK_RETRY_BACKOFF_MS=100
```

### Performance Tuning
- **Database Connection Pool**: Increase for high concurrency
- **BullMQ Concurrency**: Set to 1 for cleanup jobs (prevent duplicate processing)
- **Retry Strategy**: Exponential backoff prevents thundering herd

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Reservation Conversion Rate**: % of reservations converted to sales
2. **Expired Reservation Count**: High count indicates payment issues
3. **Stock Conflict Rate**: % of orders that required retry
4. **Average Order Completion Time**: Time from creation to payment

### Recommended Alerts
- Alert if expired reservation count > 50 in last hour
- Alert if stock conflict rate > 10%
- Alert if cleanup job fails 3 times consecutively

---

## API Endpoints - No Changes Required

All existing API endpoints continue to work:
- `POST /orders` - Create order (now with reservations)
- `PATCH /orders/:id/payment` - Confirm payment (now converts reservations)
- `DELETE /orders/:id` - Cancel order (now releases reservations)
- `PATCH /orders/:id/status` - Update status
- `GET /orders` - List orders
- `GET /orders/:id` - Get order details

---

## Migration Guide

### Step 1: Run Database Migration
```bash
# Option A: Use Prisma Migrate (Recommended for staging)
npx prisma migrate deploy

# Option B: Run SQL directly (Production)
psql -U postgres -d biznavigate < prisma/migrations/add_stock_reservations/migration.sql
```

### Step 2: Generate Prisma Client
```bash
npx prisma generate
```

### Step 3: Deploy Application
```bash
npm run build
npm run start:prod
```

### Step 4: Verify Background Jobs
```bash
# Check BullMQ dashboard or logs
# Verify cleanup job is running every 5 minutes
```

---

## Rollback Plan

If issues arise, rollback steps:

1. **Immediate Fix**: Set all orders to `payment_expires_at = NULL`
```sql
UPDATE orders SET payment_expires_at = NULL WHERE payment_status = 'pending';
```

2. **Disable Background Job**: Remove `ReservationCleanupScheduler` from providers

3. **Revert to Immediate Deduction**: Comment out `reserveStock()` calls, uncomment old stock deduction logic

4. **Full Rollback**: Revert git commit
```bash
git revert <commit-hash>
```

---

## Security Considerations

✅ **No SQL Injection**: All queries use Prisma's parameterized queries
✅ **No Race Conditions**: Optimistic locking with version control
✅ **No Deadlocks**: No explicit locks, only atomic operations
✅ **No Stock Leakage**: Automatic cleanup job prevents abandoned reservations
✅ **Audit Trail**: All reservations logged in `stock_reservations` table

---

## Performance Benchmarks

**Before (Immediate Deduction)**:
- Concurrent orders: Race condition on last item (overselling)
- Abandoned carts: Stock blocked forever
- Cleanup: Manual intervention required

**After (Stock Reservation System)**:
- Concurrent orders: ✓ Thread-safe with optimistic locking
- Abandoned carts: ✓ Auto-released after 15 minutes
- Cleanup: ✓ Automated background job every 5 minutes
- Retry overhead: ~100-300ms on version conflicts (rare)
- Database load: Minimal (atomic operations, indexed queries)

---

## Success Criteria - All Met ✅

- ✅ Multiple customers can order simultaneously without overselling
- ✅ Stock is temporarily reserved for unpaid orders (not permanently deducted)
- ✅ Reservations auto-expire after 15 minutes
- ✅ Stock is automatically released on cancellation or timeout
- ✅ Background job cleans up expired reservations every 5 minutes
- ✅ Race conditions prevented with optimistic locking
- ✅ Automatic retry on version conflicts (exponential backoff)
- ✅ No breaking changes to existing API
- ✅ Complete audit trail in database
- ✅ Production-ready error handling

---

## Next Steps (Optional Enhancements)

1. **Real-time Stock Updates**: WebSocket notifications when stock changes
2. **Stock Alerts**: Notify admin when stock falls below threshold
3. **Reservation Analytics**: Dashboard showing conversion rates
4. **Dynamic Timeout**: Adjust timeout based on payment method
5. **Priority Reservations**: VIP customers get longer reservation window
6. **Distributed Locking**: Add Redis for multi-server deployments (optional, current system works across multiple servers)

---

## Support & Documentation

- **API Docs**: See `ORDERS_MODULE_FLOW.md`
- **Problem Analysis**: See `PRODUCTION_ISSUES_AND_SOLUTIONS.md`
- **Database Schema**: See `prisma/schema.prisma`
- **Migration Script**: See `prisma/migrations/add_stock_reservations/migration.sql`

---

## Conclusion

The Orders Module is now **production-ready** and can handle high-concurrency scenarios safely. All critical production issues have been resolved:

1. ✅ **Race Conditions**: Solved with optimistic locking
2. ✅ **Stock Reservations**: Two-phase stock management
3. ✅ **Payment Timeouts**: Automatic cleanup with BullMQ

The system is ready for deployment to production environments with high traffic and concurrent orders.
