/**
 * StockAlert Domain Entity
 * Low stock and reorder alerts
 */

export enum AlertType {
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  REORDER_NEEDED = 'reorder_needed',
  OVERSTOCK = 'overstock',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export class StockAlert {
  constructor(
    public readonly alertId: string,
    public readonly businessId: string,
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly variantId: string,
    public readonly inventoryLevelId: string,
    public readonly alertType: AlertType,
    public readonly currentQuantity: number,
    public severity: AlertSeverity = AlertSeverity.WARNING,
    public status: AlertStatus = AlertStatus.ACTIVE,
    public reorderPoint?: number,
    public recommendedOrderQuantity?: number,
    public acknowledgedAt?: Date,
    public acknowledgedBy?: string,
    public resolvedAt?: Date,
    public resolvedBy?: string,
    public resolutionNotes?: string,
    public notificationSent: boolean = false,
    public notificationSentAt?: Date,
    public metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  /**
   * Check if alert is active
   */
  isActive(): boolean {
    return this.status === AlertStatus.ACTIVE;
  }

  /**
   * Check if alert is critical
   */
  isCritical(): boolean {
    return this.severity === AlertSeverity.CRITICAL;
  }

  /**
   * Acknowledge alert
   */
  acknowledge(acknowledgedBy: string): void {
    if (this.status !== AlertStatus.ACTIVE) {
      throw new Error('Only active alerts can be acknowledged');
    }

    this.status = AlertStatus.ACKNOWLEDGED;
    this.acknowledgedAt = new Date();
    this.acknowledgedBy = acknowledgedBy;
    this.updatedAt = new Date();
  }

  /**
   * Resolve alert
   */
  resolve(resolvedBy: string, resolutionNotes?: string): void {
    if (this.status === AlertStatus.RESOLVED) {
      throw new Error('Alert is already resolved');
    }

    this.status = AlertStatus.RESOLVED;
    this.resolvedAt = new Date();
    this.resolvedBy = resolvedBy;
    this.resolutionNotes = resolutionNotes;
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as sent
   */
  markNotificationSent(): void {
    this.notificationSent = true;
    this.notificationSentAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Get alert age in hours
   */
  getAgeInHours(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Get alert message
   */
  getMessage(): string {
    switch (this.alertType) {
      case AlertType.LOW_STOCK:
        return `Low stock alert: Only ${this.currentQuantity} units remaining (reorder point: ${this.reorderPoint})`;
      case AlertType.OUT_OF_STOCK:
        return `Out of stock: Product is currently unavailable`;
      case AlertType.REORDER_NEEDED:
        return `Reorder needed: Current stock ${this.currentQuantity} is below reorder point ${this.reorderPoint}. Recommended order: ${this.recommendedOrderQuantity} units`;
      case AlertType.OVERSTOCK:
        return `Overstock warning: Current stock ${this.currentQuantity} exceeds maximum stock level`;
      default:
        return `Stock alert for variant`;
    }
  }

  /**
   * Validate stock alert
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.alertType) {
      errors.push('Alert type is required');
    }

    if (this.currentQuantity < 0) {
      errors.push('Current quantity cannot be negative');
    }

    if (this.status === AlertStatus.ACKNOWLEDGED && !this.acknowledgedBy) {
      errors.push('Acknowledged alerts must have acknowledgedBy');
    }

    if (this.status === AlertStatus.RESOLVED && !this.resolvedBy) {
      errors.push('Resolved alerts must have resolvedBy');
    }

    return errors;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      alertId: this.alertId,
      businessId: this.businessId,
      tenantId: this.tenantId,
      warehouseId: this.warehouseId,
      variantId: this.variantId,
      inventoryLevelId: this.inventoryLevelId,
      alertType: this.alertType,
      severity: this.severity,
      status: this.status,
      currentQuantity: this.currentQuantity,
      reorderPoint: this.reorderPoint,
      recommendedOrderQuantity: this.recommendedOrderQuantity,
      message: this.getMessage(),
      ageInHours: this.getAgeInHours(),
      acknowledgedAt: this.acknowledgedAt,
      acknowledgedBy: this.acknowledgedBy,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      resolutionNotes: this.resolutionNotes,
      notificationSent: this.notificationSent,
      notificationSentAt: this.notificationSentAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create low stock alert
   */
  static createLowStockAlert(
    alertId: string,
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    currentQuantity: number,
    reorderPoint: number,
    recommendedOrderQuantity: number,
  ): StockAlert {
    return new StockAlert(
      alertId,
      businessId,
      tenantId,
      warehouseId,
      variantId,
      inventoryLevelId,
      AlertType.LOW_STOCK,
      currentQuantity,
      AlertSeverity.WARNING,
      AlertStatus.ACTIVE,
      reorderPoint,
      recommendedOrderQuantity,
    );
  }

  /**
   * Create out of stock alert
   */
  static createOutOfStockAlert(
    alertId: string,
    businessId: string,
    tenantId: string,
    warehouseId: string,
    variantId: string,
    inventoryLevelId: string,
    reorderPoint: number,
    recommendedOrderQuantity: number,
  ): StockAlert {
    return new StockAlert(
      alertId,
      businessId,
      tenantId,
      warehouseId,
      variantId,
      inventoryLevelId,
      AlertType.OUT_OF_STOCK,
      0,
      AlertSeverity.CRITICAL,
      AlertStatus.ACTIVE,
      reorderPoint,
      recommendedOrderQuantity,
    );
  }
}
