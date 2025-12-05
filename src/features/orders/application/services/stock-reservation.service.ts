import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Stock Reservation Service
 * Handles thread-safe stock operations with race condition protection
 *
 * Key Features:
 * - Optimistic locking to prevent overselling
 * - Stock reservations for unpaid orders
 * - Automatic reservation expiry
 * - Atomic stock operations
 */
@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);
  private readonly RESERVATION_TIMEOUT_MINUTES = 15;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve stock for an order (with race condition protection)
   * Uses optimistic locking to prevent concurrent order conflicts
   *
   * @param orderId - The order ID
   * @param productId - Product to reserve
   * @param variantId - Optional variant ID
   * @param quantity - Quantity to reserve
   * @param tx - Optional transaction context (to avoid nested transactions)
   * @returns Reservation ID
   */
  async reserveStock(
    orderId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number,
    tx?: any,
  ): Promise<string> {
    // If transaction is provided, use it directly (no retries needed as parent handles it)
    if (tx) {
      return this.executeReservation(tx, orderId, productId, variantId, quantity);
    }

    // Otherwise, create own transaction with retry logic
    let attempts = 0;

    while (attempts < this.MAX_RETRY_ATTEMPTS) {
      try {
        attempts++;

        const result = await this.prisma.$transaction(async (txn) => {
          return this.executeReservation(txn, orderId, productId, variantId, quantity);
        });

        return result;
      } catch (error) {
        if (error instanceof ConflictException && attempts < this.MAX_RETRY_ATTEMPTS) {
          this.logger.warn(`Retry ${attempts}/${this.MAX_RETRY_ATTEMPTS}: ${error.message}`);
          await this.sleep(50 * attempts); // Exponential backoff
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Failed to reserve stock after maximum retries');
  }

  /**
   * Execute the stock reservation logic
   * @private
   */
  private async executeReservation(
    tx: any,
    orderId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ): Promise<string> {
          // Step 1: Get current product with version (for optimistic locking)
          const product = await tx.products.findUnique({
            where: { product_id: productId },
            include: { product_variants: true },
          });

          if (!product) {
            throw new BadRequestException(`Product not found: ${productId}`);
          }

          // Step 2: Determine which stock to check
          let currentStock: number;
          let currentReserved: number;
          let currentVersion: number;

          if (variantId) {
            const variant = product.product_variants.find((v) => v.variant_id === variantId);
            if (!variant) {
              throw new BadRequestException(`Variant not found: ${variantId}`);
            }
            currentStock = variant.quantity;
            currentReserved = variant.reserved_stock || 0;
            currentVersion = variant.version || 0;
          } else {
            currentStock = product.stock_quantity || 0;
            currentReserved = product.reserved_stock || 0;
            currentVersion = product.version || 0;
          }

          // Step 3: Calculate available stock
          const availableStock = currentStock - currentReserved;

          if (availableStock < quantity) {
            throw new ConflictException(
              `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
            );
          }

          // Step 4: Atomic update with version check (prevents race conditions)
          if (variantId) {
            const updateResult = await tx.product_variants.updateMany({
              where: {
                variant_id: variantId,
                version: currentVersion, // Optimistic lock check
              },
              data: {
                reserved_stock: currentReserved + quantity,
                version: currentVersion + 1,
              },
            });

            if (updateResult.count === 0) {
              throw new ConflictException('Stock updated by another process. Retrying...');
            }
          } else {
            const updateResult = await tx.products.updateMany({
              where: {
                product_id: productId,
                version: currentVersion, // Optimistic lock check
              },
              data: {
                reserved_stock: currentReserved + quantity,
                version: currentVersion + 1,
              },
            });

            if (updateResult.count === 0) {
              throw new ConflictException('Stock updated by another process. Retrying...');
            }
          }

          // Step 5: Create reservation record
          const expiresAt = new Date(Date.now() + this.RESERVATION_TIMEOUT_MINUTES * 60 * 1000);

          const reservation = await tx.stock_reservations.create({
            data: {
              order_id: orderId,
              product_id: productId,
              variant_id: variantId,
              quantity,
              expires_at: expiresAt,
              status: 'active',
            },
          });

          return reservation.reservation_id;
  }

  /**
   * Convert reservation to actual sale (after payment confirmation)
   *
   * @param orderId - Order ID
   */
  async convertReservationToSale(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Step 1: Get all reservations for this order
      const reservations = await tx.stock_reservations.findMany({
        where: {
          order_id: orderId,
          status: 'active',
        },
      });

      if (reservations.length === 0) {
        this.logger.warn(`No active reservations found for order: ${orderId}`);
        return;
      }

      // Step 2: For each reservation, convert to sale
      for (const reservation of reservations) {
        if (reservation.variant_id) {
          // Update variant stock
          await tx.product_variants.update({
            where: { variant_id: reservation.variant_id },
            data: {
              quantity: { decrement: reservation.quantity },
              reserved_stock: { decrement: reservation.quantity },
              in_stock: {
                set: await this.checkIfInStock(
                  reservation.product_id,
                  reservation.variant_id,
                  reservation.quantity,
                  tx,
                ),
              },
            },
          });
        } else {
          // Update product stock
          await tx.products.update({
            where: { product_id: reservation.product_id },
            data: {
              stock_quantity: { decrement: reservation.quantity },
              reserved_stock: { decrement: reservation.quantity },
              in_stock: {
                set: await this.checkIfInStock(
                  reservation.product_id,
                  null,
                  reservation.quantity,
                  tx,
                ),
              },
            },
          });
        }

        // Mark reservation as converted
        await tx.stock_reservations.update({
          where: { reservation_id: reservation.reservation_id },
          data: { status: 'converted' },
        });
      }

      this.logger.log(`Converted ${reservations.length} reservations to sales for order: ${orderId}`);
    });
  }

  /**
   * Release reserved stock (on order cancellation or timeout)
   *
   * @param orderId - Order ID
   */
  async releaseReservation(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Step 1: Get all active reservations for this order
      const reservations = await tx.stock_reservations.findMany({
        where: {
          order_id: orderId,
          status: 'active',
        },
      });

      if (reservations.length === 0) {
        return;
      }

      // Step 2: Release each reservation
      for (const reservation of reservations) {
        if (reservation.variant_id) {
          await tx.product_variants.update({
            where: { variant_id: reservation.variant_id },
            data: {
              reserved_stock: { decrement: reservation.quantity },
              in_stock: true, // Stock is available again
            },
          });
        } else {
          await tx.products.update({
            where: { product_id: reservation.product_id },
            data: {
              reserved_stock: { decrement: reservation.quantity },
              in_stock: true,
            },
          });
        }

        // Mark reservation as expired/cancelled
        await tx.stock_reservations.update({
          where: { reservation_id: reservation.reservation_id },
          data: { status: 'expired' },
        });
      }

      this.logger.log(`Released ${reservations.length} reservations for order: ${orderId}`);
    });
  }

  /**
   * Clean up expired reservations (called by background job)
   */
  async cleanupExpiredReservations(): Promise<number> {
    const now = new Date();

    const expiredReservations = await this.prisma.stock_reservations.findMany({
      where: {
        status: 'active',
        expires_at: { lte: now },
      },
    });

    let cleanedCount = 0;

    for (const reservation of expiredReservations) {
      try {
        await this.releaseReservation(reservation.order_id);
        cleanedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to cleanup reservation ${reservation.reservation_id}: ${error.message}`,
        );
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired reservations`);
    }

    return cleanedCount;
  }

  /**
   * Get available stock (actual stock - reserved stock)
   *
   * @param productId - Product ID
   * @param variantId - Optional variant ID
   * @returns Available stock quantity
   */
  async getAvailableStock(productId: string, variantId?: string): Promise<number> {
    if (variantId) {
      const variant = await this.prisma.product_variants.findUnique({
        where: { variant_id: variantId },
      });

      if (!variant) {
        throw new BadRequestException(`Variant not found: ${variantId}`);
      }

      return variant.quantity - (variant.reserved_stock || 0);
    } else {
      const product = await this.prisma.products.findUnique({
        where: { product_id: productId },
      });

      if (!product) {
        throw new BadRequestException(`Product not found: ${productId}`);
      }

      return (product.stock_quantity || 0) - (product.reserved_stock || 0);
    }
  }

  /**
   * Check if product will be in stock after deduction
   */
  private async checkIfInStock(
    productId: string,
    variantId: string | null,
    quantityToDeduct: number,
    tx: any,
  ): Promise<boolean> {
    if (variantId) {
      const variant = await tx.product_variants.findUnique({
        where: { variant_id: variantId },
      });
      return variant ? variant.quantity - quantityToDeduct > 0 : false;
    } else {
      const product = await tx.products.findUnique({
        where: { product_id: productId },
      });
      return product && product.stock_quantity
        ? product.stock_quantity - quantityToDeduct > 0
        : false;
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
