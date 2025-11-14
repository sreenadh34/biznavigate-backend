# Production Issues & Solutions - Orders Module

## Critical Problems Identified

### 🔴 Problem 1: Race Condition - Concurrent Orders
**Scenario**: 100 customers ordering the last 50 items simultaneously

**Current Code Issue**:
```typescript
// ❌ NOT THREAD-SAFE
const product = await tx.products.findUnique({ where: { product_id } });
if (product.stock_quantity >= quantity) {
  await tx.products.update({
    data: { stock_quantity: { decrement: quantity } }
  });
}
```

**What Happens**:
```
Time    Customer A              Customer B              Stock
0ms     Read stock = 1          -                       1
5ms     -                       Read stock = 1          1
10ms    Check: 1 >= 1 ✓         -                       1
15ms    -                       Check: 1 >= 1 ✓         1
20ms    Decrement: stock = 0    -                       0
25ms    -                       Decrement: stock = -1   -1 ❌ OVERSOLD!
```

---

### 🔴 Problem 2: No Stock Reservation System
**Scenario**: Customer creates order but doesn't pay

**Current Flow**:
```
1. Create order → Stock deducted immediately
2. Customer browsing payment options...
3. 30 minutes later → Still no payment
4. Stock: Unavailable to other customers ❌
5. Revenue: Lost
```

---

### 🔴 Problem 3: No Payment Timeout
**Current**: Orders stay "pending" forever, blocking stock

---

## Solutions Implemented

### ✅ Solution 1: Optimistic Locking with Database-Level Constraints

**Strategy**: Use PostgreSQL row-level locking

```sql
-- Add version column for optimistic locking
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN version INTEGER DEFAULT 0;

-- Update with version check (atomic)
UPDATE products
SET stock_quantity = stock_quantity - $quantity,
    version = version + 1
WHERE product_id = $id
  AND stock_quantity >= $quantity
  AND version = $currentVersion
RETURNING *;
-- If 0 rows affected → Stock insufficient or version mismatch
```

### ✅ Solution 2: Stock Reservation System

**New Flow**:
```
1. Create order (status: "draft")
2. RESERVE stock (new table: stock_reservations)
3. Stock becomes "reserved" not "sold"
4. Customer has 15 minutes to pay
5a. Payment received → Convert reservation to sale
5b. Timeout → Release reservation automatically
```

### ✅ Solution 3: Payment Timeout with Background Jobs

**Implementation**:
- BullMQ delayed jobs
- Auto-cancel orders after timeout
- Auto-release reserved stock

---

## Implementation Plan

### Step 1: Database Schema Updates
### Step 2: Stock Reservation Table
### Step 3: Race Condition Handler
### Step 4: Payment Timeout Scheduler
### Step 5: Background Job Processor
