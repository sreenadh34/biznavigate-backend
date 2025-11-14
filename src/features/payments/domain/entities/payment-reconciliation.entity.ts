/**
 * Payment Reconciliation Entity
 * Tracks daily settlement reconciliation with Razorpay
 */
export class PaymentReconciliation {
  reconciliation_id: string;
  business_id: string;

  // Settlement details
  settlement_date: Date;
  total_payments: number;
  total_amount: number;
  total_fees: number;
  net_amount: number;

  // Reconciliation status
  status: ReconciliationStatus;
  discrepancy_count: number;
  discrepancy_details?: any; // JSON with discrepancy information

  // Timestamps
  created_at: Date;
  updated_at: Date;
  reconciled_at?: Date;
}

/**
 * Reconciliation Status Enum
 */
export enum ReconciliationStatus {
  PENDING = 'pending', // Not yet reconciled
  MATCHED = 'matched', // All payments matched with settlement
  DISCREPANCY = 'discrepancy', // Mismatches found
  RESOLVED = 'resolved', // Discrepancies resolved
}
