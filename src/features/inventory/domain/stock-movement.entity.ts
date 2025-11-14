/**
 * StockMovement Domain Entity
 * Complete audit trail of all inventory changes
 */

export enum MovementType {
  PURCHASE = 'purchase',           // Stock received from supplier
  SALE = 'sale',                   // Stock sold to customer
  ADJUSTMENT = 'adjustment',       // Manual adjustment (count, correction)
  TRANSFER_OUT = 'transfer_out',   // Transfer to another warehouse
  TRANSFER_IN = 'transfer_in',     // Transfer from another warehouse
  DAMAGE = 'damage',               // Stock marked as damaged
  RETURN = 'return',               // Customer return
  WRITE_OFF = 'write_off',         // Write off damaged/expired stock
  PRODUCTION = 'production',       // Stock created via production
  CONSUMPTION = 'consumption',     // Stock consumed in production
}

export class StockMovement {
  constructor(
    public readonly movementId: string,
    public readonly businessId: string,
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly variantId: string,
    public readonly inventoryLevelId: string,
    public readonly movementType: MovementType,
    public readonly quantityChange: number,
    public readonly quantityBefore: number,
    public readonly quantityAfter: number,
    public readonly movementDate: Date = new Date(),
    public referenceType?: string,
    public referenceId?: string,
    public unitCost?: number,
    public totalCost?: number,
    public fromWarehouseId?: string,
    public toWarehouseId?: string,
    public reason?: string,
    public notes?: string,
    public createdBy?: string,
    public approvedBy?: string,
    public metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
  ) {}

  /**
   * Verify quantity consistency
   */
  verifyQuantityConsistency(): boolean {
    return this.quantityAfter === this.quantityBefore + this.quantityChange;
  }

  /**
   * Check if movement increases stock
   */
  isInbound(): boolean {
    return this.quantityChange > 0;
  }

  /**
   * Check if movement decreases stock
   */
  isOutbound(): boolean {
    return this.quantityChange < 0;
  }

  /**
   * Get absolute quantity change
   */
  getAbsoluteQuantityChange(): number {
    return Math.abs(this.quantityChange);
  }

  /**
   * Check if movement is a transfer
   */
  isTransfer(): boolean {
    return this.movementType === MovementType.TRANSFER_IN || this.movementType === MovementType.TRANSFER_OUT;
  }

  /**
   * Get movement description
   */
  getDescription(): string {
    const action = this.isInbound() ? 'Added' : 'Removed';
    const quantity = this.getAbsoluteQuantityChange();

    let description = `${action} ${quantity} units via ${this.movementType}`;

    if (this.referenceType && this.referenceId) {
      description += ` (Ref: ${this.referenceType} ${this.referenceId})`;
    }

    if (this.reason) {
      description += ` - ${this.reason}`;
    }

    return description;
  }

  /**
   * Validate stock movement
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.movementType) {
      errors.push('Movement type is required');
    }

    if (this.quantityChange === 0) {
      errors.push('Quantity change cannot be zero');
    }

    if (this.quantityBefore < 0) {
      errors.push('Quantity before cannot be negative');
    }

    if (this.quantityAfter < 0) {
      errors.push('Quantity after cannot be negative');
    }

    if (!this.verifyQuantityConsistency()) {
      errors.push('Quantity consistency check failed: quantityAfter must equal quantityBefore + quantityChange');
    }

    if (this.isTransfer() && !this.fromWarehouseId && !this.toWarehouseId) {
      errors.push('Transfer movements must specify from/to warehouse');
    }

    if (this.unitCost !== undefined && this.unitCost < 0) {
      errors.push('Unit cost cannot be negative');
    }

    if (this.totalCost !== undefined && this.totalCost < 0) {
      errors.push('Total cost cannot be negative');
    }

    return errors;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      movementId: this.movementId,
      businessId: this.businessId,
      tenantId: this.tenantId,
      warehouseId: this.warehouseId,
      variantId: this.variantId,
      inventoryLevelId: this.inventoryLevelId,
      movementType: this.movementType,
      quantityChange: this.quantityChange,
      quantityBefore: this.quantityBefore,
      quantityAfter: this.quantityAfter,
      absQuantityChange: this.getAbsoluteQuantityChange(),
      isInbound: this.isInbound(),
      isOutbound: this.isOutbound(),
      movementDate: this.movementDate,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      unitCost: this.unitCost,
      totalCost: this.totalCost,
      fromWarehouseId: this.fromWarehouseId,
      toWarehouseId: this.toWarehouseId,
      reason: this.reason,
      notes: this.notes,
      description: this.getDescription(),
      createdBy: this.createdBy,
      approvedBy: this.approvedBy,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create a purchase movement
   */
  static createPurchase(
    movementId: string,
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    quantity: number,
    quantityBefore: number,
    unitCost: number,
    referenceId?: string,
    createdBy?: string,
  ): StockMovement {
    return new StockMovement(
      movementId,
      businessId,
      tenantId,
      warehouseId,
      variantId,
      inventoryLevelId,
      MovementType.PURCHASE,
      quantity,
      quantityBefore,
      quantityBefore + quantity,
      new Date(),
      'purchase_order',
      referenceId,
      unitCost,
      quantity * unitCost,
      undefined,
      undefined,
      'Stock received from supplier',
      undefined,
      createdBy,
    );
  }

  /**
   * Create a sale movement
   */
  static createSale(
    movementId: string,
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    quantity: number,
    quantityBefore: number,
    orderId: string,
    createdBy?: string,
  ): StockMovement {
    return new StockMovement(
      movementId,
      businessId,
      tenantId,
      warehouseId,
      variantId,
      inventoryLevelId,
      MovementType.SALE,
      -quantity,
      quantityBefore,
      quantityBefore - quantity,
      new Date(),
      'order',
      orderId,
      undefined,
      undefined,
      undefined,
      undefined,
      'Stock sold to customer',
      undefined,
      createdBy,
    );
  }

  /**
   * Create an adjustment movement
   */
  static createAdjustment(
    movementId: string,
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    quantityChange: number,
    quantityBefore: number,
    reason: string,
    createdBy?: string,
  ): StockMovement {
    return new StockMovement(
      movementId,
      businessId,
      tenantId,
      warehouseId,
      variantId,
      inventoryLevelId,
      MovementType.ADJUSTMENT,
      quantityChange,
      quantityBefore,
      quantityBefore + quantityChange,
      new Date(),
      'adjustment',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      reason,
      undefined,
      createdBy,
    );
  }

  /**
   * Create a transfer-out movement
   */
  static createTransferOut(
    movementId: string,
    businessId: string,
    tenantId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    quantity: number,
    quantityBefore: number,
    transferId: string,
    createdBy?: string,
  ): StockMovement {
    return new StockMovement(
      movementId,
      businessId,
      tenantId,
      fromWarehouseId,
      variantId,
      inventoryLevelId,
      MovementType.TRANSFER_OUT,
      -quantity,
      quantityBefore,
      quantityBefore - quantity,
      new Date(),
      'transfer',
      transferId,
      undefined,
      undefined,
      fromWarehouseId,
      toWarehouseId,
      'Transfer to another warehouse',
      undefined,
      createdBy,
    );
  }

  /**
   * Create a transfer-in movement
   */
  static createTransferIn(
    movementId: string,
    businessId: string,
    tenantId: string,
    toWarehouseId: string,
    fromWarehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    quantity: number,
    quantityBefore: number,
    transferId: string,
    createdBy?: string,
  ): StockMovement {
    return new StockMovement(
      movementId,
      businessId,
      tenantId,
      toWarehouseId,
      variantId,
      inventoryLevelId,
      MovementType.TRANSFER_IN,
      quantity,
      quantityBefore,
      quantityBefore + quantity,
      new Date(),
      'transfer',
      transferId,
      undefined,
      undefined,
      fromWarehouseId,
      toWarehouseId,
      'Transfer from another warehouse',
      undefined,
      createdBy,
    );
  }
}
