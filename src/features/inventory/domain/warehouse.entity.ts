/**
 * Warehouse Domain Entity
 * Represents a physical warehouse or storage location
 */

export interface WarehouseAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface WarehouseContact {
  person?: string;
  email?: string;
  phone?: string;
}

export interface OperatingHours {
  monday?: { open: string; close: string; closed: boolean };
  tuesday?: { open: string; close: string; closed: boolean };
  wednesday?: { open: string; close: string; closed: boolean };
  thursday?: { open: string; close: string; closed: boolean };
  friday?: { open: string; close: string; closed: boolean };
  saturday?: { open: string; close: string; closed: boolean };
  sunday?: { open: string; close: string; closed: boolean };
}

export class Warehouse {
  constructor(
    public readonly warehouseId: string,
    public readonly businessId: string,
    public readonly tenantId: string,
    public warehouseName: string,
    public warehouseCode: string,
    public warehouseType: string,
    public address: WarehouseAddress,
    public contact: WarehouseContact,
    public totalCapacity?: number,
    public usedCapacity: number = 0,
    public isDefault: boolean = false,
    public isActive: boolean = true,
    public priority: number = 5,
    public operatingHours: OperatingHours = {},
    public metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  /**
   * Calculate available capacity
   */
  getAvailableCapacity(): number | undefined {
    if (!this.totalCapacity) return undefined;
    return this.totalCapacity - this.usedCapacity;
  }

  /**
   * Check if warehouse has capacity for new items
   */
  hasCapacity(requiredCapacity: number): boolean {
    if (!this.totalCapacity) return true; // No capacity limit
    return this.getAvailableCapacity()! >= requiredCapacity;
  }

  /**
   * Get capacity usage percentage
   */
  getCapacityUsagePercent(): number {
    if (!this.totalCapacity) return 0;
    return (this.usedCapacity / this.totalCapacity) * 100;
  }

  /**
   * Check if warehouse is operating at given time
   */
  isOperating(dayOfWeek: string, time: string): boolean {
    const hours = this.operatingHours[dayOfWeek.toLowerCase()];
    if (!hours || hours.closed) return false;

    const currentTime = new Date(`1970-01-01T${time}`);
    const openTime = new Date(`1970-01-01T${hours.open}`);
    const closeTime = new Date(`1970-01-01T${hours.close}`);

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Activate warehouse
   */
  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Deactivate warehouse
   */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Set as default warehouse
   */
  setAsDefault(): void {
    this.isDefault = true;
    this.updatedAt = new Date();
  }

  /**
   * Update warehouse details
   */
  updateDetails(updates: {
    warehouseName?: string;
    warehouseType?: string;
    address?: Partial<WarehouseAddress>;
    contact?: Partial<WarehouseContact>;
    totalCapacity?: number;
    priority?: number;
    operatingHours?: OperatingHours;
  }): void {
    if (updates.warehouseName) this.warehouseName = updates.warehouseName;
    if (updates.warehouseType) this.warehouseType = updates.warehouseType;
    if (updates.address) this.address = { ...this.address, ...updates.address };
    if (updates.contact) this.contact = { ...this.contact, ...updates.contact };
    if (updates.totalCapacity !== undefined) this.totalCapacity = updates.totalCapacity;
    if (updates.priority !== undefined) this.priority = updates.priority;
    if (updates.operatingHours) this.operatingHours = updates.operatingHours;

    this.updatedAt = new Date();
  }

  /**
   * Validate warehouse data
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.warehouseName || this.warehouseName.trim() === '') {
      errors.push('Warehouse name is required');
    }

    if (!this.warehouseCode || this.warehouseCode.trim() === '') {
      errors.push('Warehouse code is required');
    }

    if (this.totalCapacity !== undefined && this.totalCapacity < 0) {
      errors.push('Total capacity cannot be negative');
    }

    if (this.usedCapacity < 0) {
      errors.push('Used capacity cannot be negative');
    }

    if (this.totalCapacity && this.usedCapacity > this.totalCapacity) {
      errors.push('Used capacity cannot exceed total capacity');
    }

    if (this.priority < 1 || this.priority > 10) {
      errors.push('Priority must be between 1 and 10');
    }

    return errors;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      warehouseId: this.warehouseId,
      businessId: this.businessId,
      tenantId: this.tenantId,
      warehouseName: this.warehouseName,
      warehouseCode: this.warehouseCode,
      warehouseType: this.warehouseType,
      address: this.address,
      contact: this.contact,
      totalCapacity: this.totalCapacity,
      usedCapacity: this.usedCapacity,
      availableCapacity: this.getAvailableCapacity(),
      capacityUsagePercent: this.getCapacityUsagePercent(),
      isDefault: this.isDefault,
      isActive: this.isActive,
      priority: this.priority,
      operatingHours: this.operatingHours,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
