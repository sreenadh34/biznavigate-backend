/**
 * InventoryLevel Domain Entity
 * Represents real-time stock levels for a product variant in a specific warehouse
 */

export interface StockLocation {
  binLocation?: string;
  aisle?: string;
  shelf?: string;
}

export class InventoryLevel {
  constructor(
    public readonly inventoryLevelId: string,
    public readonly businessId: string,
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly variantId: string,
    public availableQuantity: number = 0,
    public reservedQuantity: number = 0,
    public damagedQuantity: number = 0,
    public inTransitQuantity: number = 0,
    public reorderPoint: number = 10,
    public reorderQuantity: number = 50,
    public maxStockLevel?: number,
    public averageCost: number = 0,
    public totalValue: number = 0,
    public location: StockLocation = {},
    public lastCountedAt?: Date,
    public lastRestockAt?: Date,
    public isLowStock: boolean = false,
    public isOutOfStock: boolean = false,
    public metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  /**
   * Calculate total quantity (all stock types)
   */
  getTotalQuantity(): number {
    return this.availableQuantity + this.reservedQuantity + this.damagedQuantity + this.inTransitQuantity;
  }

  /**
   * Get actual sellable quantity (available - reserved)
   */
  getSellableQuantity(): number {
    return Math.max(0, this.availableQuantity - this.reservedQuantity);
  }

  /**
   * Check if stock is low
   */
  checkIsLowStock(): boolean {
    return this.availableQuantity > 0 && this.availableQuantity <= this.reorderPoint;
  }

  /**
   * Check if stock is out
   */
  checkIsOutOfStock(): boolean {
    return this.availableQuantity === 0;
  }

  /**
   * Update stock flags
   */
  updateStockFlags(): void {
    this.isLowStock = this.checkIsLowStock();
    this.isOutOfStock = this.checkIsOutOfStock();
    this.updatedAt = new Date();
  }

  /**
   * Calculate recommended reorder quantity
   */
  getRecommendedReorderQuantity(): number {
    if (!this.isLowStock && !this.isOutOfStock) return 0;

    const shortfall = Math.max(0, this.reorderPoint - this.availableQuantity);
    return Math.max(this.reorderQuantity, shortfall);
  }

  /**
   * Add available stock
   */
  addStock(quantity: number, unitCost?: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    this.availableQuantity += quantity;

    // Update average cost using weighted average method
    if (unitCost) {
      const oldValue = this.totalValue;
      const newValue = quantity * unitCost;
      this.totalValue = oldValue + newValue;
      this.averageCost = this.totalValue / this.getTotalQuantity();
    }

    this.lastRestockAt = new Date();
    this.updateStockFlags();
  }

  /**
   * Deduct available stock
   */
  deductStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.availableQuantity) {
      throw new Error(`Insufficient stock. Available: ${this.availableQuantity}, Requested: ${quantity}`);
    }

    this.availableQuantity -= quantity;
    this.totalValue = this.availableQuantity * this.averageCost;
    this.updateStockFlags();
  }

  /**
   * Reserve stock (for pending orders)
   */
  reserveStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.availableQuantity) {
      throw new Error(`Insufficient available stock to reserve. Available: ${this.availableQuantity}, Requested: ${quantity}`);
    }

    this.availableQuantity -= quantity;
    this.reservedQuantity += quantity;
    this.updateStockFlags();
  }

  /**
   * Release reserved stock (order cancelled)
   */
  releaseReservedStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.reservedQuantity) {
      throw new Error(`Cannot release more than reserved. Reserved: ${this.reservedQuantity}, Requested: ${quantity}`);
    }

    this.reservedQuantity -= quantity;
    this.availableQuantity += quantity;
    this.updateStockFlags();
  }

  /**
   * Confirm sale (convert reserved to sold)
   */
  confirmSale(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.reservedQuantity) {
      throw new Error(`Cannot confirm more than reserved. Reserved: ${this.reservedQuantity}, Requested: ${quantity}`);
    }

    this.reservedQuantity -= quantity;
    this.totalValue = (this.availableQuantity + this.reservedQuantity) * this.averageCost;
    this.updateStockFlags();
  }

  /**
   * Mark stock as damaged
   */
  markAsDamaged(quantity: number, fromAvailable: boolean = true): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (fromAvailable) {
      if (quantity > this.availableQuantity) {
        throw new Error(`Insufficient available stock. Available: ${this.availableQuantity}, Requested: ${quantity}`);
      }
      this.availableQuantity -= quantity;
    }

    this.damagedQuantity += quantity;
    this.updateStockFlags();
  }

  /**
   * Write off damaged stock
   */
  writeOffDamagedStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.damagedQuantity) {
      throw new Error(`Cannot write off more than damaged. Damaged: ${this.damagedQuantity}, Requested: ${quantity}`);
    }

    this.damagedQuantity -= quantity;
    this.updatedAt = new Date();
  }

  /**
   * Add in-transit stock
   */
  addInTransit(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    this.inTransitQuantity += quantity;
    this.updatedAt = new Date();
  }

  /**
   * Receive in-transit stock
   */
  receiveInTransit(quantity: number, unitCost?: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    if (quantity > this.inTransitQuantity) {
      throw new Error(`Cannot receive more than in transit. In Transit: ${this.inTransitQuantity}, Requested: ${quantity}`);
    }

    this.inTransitQuantity -= quantity;
    this.addStock(quantity, unitCost);
  }

  /**
   * Adjust stock (for physical count reconciliation)
   */
  adjustStock(newQuantity: number, reason: string): void {
    if (newQuantity < 0) {
      throw new Error('New quantity cannot be negative');
    }

    this.availableQuantity = newQuantity;
    this.totalValue = this.availableQuantity * this.averageCost;
    this.lastCountedAt = new Date();
    this.updateStockFlags();
  }

  /**
   * Update reorder settings
   */
  updateReorderSettings(reorderPoint: number, reorderQuantity: number, maxStockLevel?: number): void {
    if (reorderPoint < 0) {
      throw new Error('Reorder point cannot be negative');
    }

    if (reorderQuantity <= 0) {
      throw new Error('Reorder quantity must be positive');
    }

    this.reorderPoint = reorderPoint;
    this.reorderQuantity = reorderQuantity;
    this.maxStockLevel = maxStockLevel;
    this.updateStockFlags();
  }

  /**
   * Update location
   */
  updateLocation(location: StockLocation): void {
    this.location = { ...this.location, ...location };
    this.updatedAt = new Date();
  }

  /**
   * Validate inventory level
   */
  validate(): string[] {
    const errors: string[] = [];

    if (this.availableQuantity < 0) {
      errors.push('Available quantity cannot be negative');
    }

    if (this.reservedQuantity < 0) {
      errors.push('Reserved quantity cannot be negative');
    }

    if (this.damagedQuantity < 0) {
      errors.push('Damaged quantity cannot be negative');
    }

    if (this.inTransitQuantity < 0) {
      errors.push('In-transit quantity cannot be negative');
    }

    if (this.reorderPoint < 0) {
      errors.push('Reorder point cannot be negative');
    }

    if (this.reorderQuantity <= 0) {
      errors.push('Reorder quantity must be positive');
    }

    if (this.maxStockLevel && this.getTotalQuantity() > this.maxStockLevel) {
      errors.push(`Total quantity (${this.getTotalQuantity()}) exceeds max stock level (${this.maxStockLevel})`);
    }

    return errors;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      inventoryLevelId: this.inventoryLevelId,
      businessId: this.businessId,
      tenantId: this.tenantId,
      warehouseId: this.warehouseId,
      variantId: this.variantId,
      availableQuantity: this.availableQuantity,
      reservedQuantity: this.reservedQuantity,
      damagedQuantity: this.damagedQuantity,
      inTransitQuantity: this.inTransitQuantity,
      totalQuantity: this.getTotalQuantity(),
      sellableQuantity: this.getSellableQuantity(),
      reorderPoint: this.reorderPoint,
      reorderQuantity: this.reorderQuantity,
      maxStockLevel: this.maxStockLevel,
      recommendedReorderQuantity: this.getRecommendedReorderQuantity(),
      averageCost: this.averageCost,
      totalValue: this.totalValue,
      location: this.location,
      lastCountedAt: this.lastCountedAt,
      lastRestockAt: this.lastRestockAt,
      isLowStock: this.isLowStock,
      isOutOfStock: this.isOutOfStock,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
