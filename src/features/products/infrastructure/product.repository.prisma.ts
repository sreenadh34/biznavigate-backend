import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Product, ProductVariant } from '../domain/entities/product.entity';
import { ProductQueryDto } from '../application/dto/product-query.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Product Repository Interface
 * Defines contract for product data access
 */
export interface IProductRepository {
  create(product: Partial<Product>): Promise<Product>;
  findById(productId: string): Promise<Product | null>;
  findAll(query: ProductQueryDto): Promise<{ data: Product[]; total: number; page: number; limit: number }>;
  update(productId: string, data: Partial<Product>): Promise<Product>;
  delete(productId: string): Promise<void>;
  checkStockAvailability(productId: string, quantity: number): Promise<boolean>;
  updateStock(productId: string, quantity: number, operation: 'increment' | 'decrement'): Promise<void>;
  createVariant(variant: Partial<ProductVariant>): Promise<ProductVariant>;
  findVariantsByProductId(productId: string): Promise<ProductVariant[]>;
  updateVariant(variantId: string, data: Partial<ProductVariant>): Promise<ProductVariant>;
  deleteVariant(variantId: string): Promise<void>;
}

/**
 * Prisma implementation of Product Repository
 * Handles all database operations for products
 */
@Injectable()
export class ProductRepositoryPrisma implements IProductRepository {
  private readonly logger = new Logger(ProductRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product
   */
  async create(product: Partial<Product>): Promise<Product> {
    try {
      // Generate slug from product name
      const slug = this.generateSlug(product.name);

      // Determine in_stock status
      const in_stock = product.track_inventory
        ? (product.stock_quantity || 0) > 0
        : true;

      // Remove variants field if present - they're created separately
      const { variants, ...productData } = product as any;

      const created = await this.prisma.products.create({
        data: {
          ...productData,
          slug,
          in_stock,
          currency: product.currency || 'INR',
          track_inventory: product.track_inventory ?? true,
          is_active: product.is_active ?? true,
          has_variants: product.has_variants ?? false,
        } as any,
      });

      this.logger.log(`Product created: ${created.product_id} - ${created.name}`);
      return this.toDomainProduct(created);
    } catch (error) {
      this.logger.error(`Failed to create product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find product by ID
   */
  async findById(productId: string): Promise<Product | null> {
    try {
      const product = await this.prisma.products.findUnique({
        where: { product_id: productId },
      });

      return product ? this.toDomainProduct(product) : null;
    } catch (error) {
      this.logger.error(`Failed to find product by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all products with filtering, pagination, and sorting
   * Optimized for large datasets with optional count and cursor pagination
   */
  async findAll(query: ProductQueryDto): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    try {
      const {
        business_id,
        search,
        category,
        product_type,
        is_active,
        in_stock,
        min_price,
        max_price,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        order = 'desc',
        cursor,
        include_count = true,
      } = query;

      // Build where clause
      const where: any = {};

      if (business_id) {
        where.business_id = business_id;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (category) {
        where.category = category;
      }

      if (product_type) {
        where.product_type = product_type;
      }

      if (typeof is_active === 'boolean') {
        where.is_active = is_active;
      }

      if (typeof in_stock === 'boolean') {
        where.in_stock = in_stock;
      }

      if (min_price !== undefined || max_price !== undefined) {
        where.price = {};
        if (min_price !== undefined) {
          where.price.gte = min_price;
        }
        if (max_price !== undefined) {
          where.price.lte = max_price;
        }
      }

      // Build query options
      const queryOptions: any = {
        where,
        take: limit,
        orderBy: { [sort_by]: order },
      };

      // Use cursor-based pagination if cursor provided, otherwise offset pagination
      if (cursor) {
        queryOptions.cursor = { product_id: cursor };
        queryOptions.skip = 1; // Skip the cursor itself
      } else {
        const skip = (page - 1) * limit;
        queryOptions.skip = skip;
      }

      // Fetch products - count only if include_count is true (improves performance on large datasets)
      let products: any[];
      let total: number = 0;

      if (include_count) {
        [products, total] = await Promise.all([
          this.prisma.products.findMany(queryOptions),
          this.prisma.products.count({ where }),
        ]);
      } else {
        // Skip counting for better performance
        products = await this.prisma.products.findMany(queryOptions);
        // Return -1 to indicate count was skipped
        total = -1;
      }

      this.logger.log(
        `Found ${products.length} products${include_count ? ` (total: ${total})` : ' (count skipped for performance)'}`,
      );

      return {
        data: products.map(p => this.toDomainProduct(p)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to find products: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update product
   */
  async update(productId: string, data: Partial<Product>): Promise<Product> {
    try {
      // Update slug if name changed
      if (data.name) {
        data.slug = this.generateSlug(data.name);
      }

      // Update in_stock if stock_quantity changed
      if (data.track_inventory && data.stock_quantity !== undefined) {
        data.in_stock = data.stock_quantity > 0;
      }

      const updated = await this.prisma.products.update({
        where: { product_id: productId },
        data: data as any,
      });

      this.logger.log(`Product updated: ${updated.product_id}`);
      return this.toDomainProduct(updated);
    } catch (error) {
      this.logger.error(`Failed to update product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete product (soft delete by setting is_active = false)
   */
  async delete(productId: string): Promise<void> {
    try {
      await this.prisma.products.update({
        where: { product_id: productId },
        data: { is_active: false },
      });

      this.logger.log(`Product soft deleted: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to delete product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if sufficient stock is available
   */
  async checkStockAvailability(productId: string, quantity: number): Promise<boolean> {
    try {
      const product = await this.prisma.products.findUnique({
        where: { product_id: productId },
        select: { stock_quantity: true, track_inventory: true, in_stock: true },
      });

      if (!product) {
        return false;
      }

      // If inventory tracking is disabled, always available
      if (!product.track_inventory) {
        return true;
      }

      // Check stock quantity
      return product.in_stock && (product.stock_quantity || 0) >= quantity;
    } catch (error) {
      this.logger.error(`Failed to check stock availability: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Update stock quantity (increment or decrement)
   * Uses atomic operations with optimistic locking to prevent race conditions
   * Implements retry logic for concurrent updates
   */
  async updateStock(productId: string, quantity: number, operation: 'increment' | 'decrement'): Promise<void> {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Read current product with version for optimistic locking
          const product = await tx.products.findUnique({
            where: { product_id: productId },
            select: {
              stock_quantity: true,
              reserved_stock: true,
              version: true,
              track_inventory: true,
            },
          });

          if (!product) {
            throw new Error('Product not found');
          }

          if (!product.track_inventory) {
            throw new Error('Product does not track inventory');
          }

          // Calculate new stock quantity
          const currentStock = product.stock_quantity || 0;
          const newStock =
            operation === 'increment'
              ? currentStock + quantity
              : currentStock - quantity;

          // Prevent negative stock
          if (newStock < 0) {
            throw new Error(
              `Insufficient stock. Current: ${currentStock}, Requested: ${quantity}, Reserved: ${product.reserved_stock || 0}`,
            );
          }

          // Atomic update with version check (optimistic locking)
          const updated = await tx.products.updateMany({
            where: {
              product_id: productId,
              version: product.version, // Only update if version matches
            },
            data: {
              stock_quantity: newStock,
              in_stock: newStock > 0,
              version: { increment: 1 }, // Increment version
              updated_at: new Date(),
            },
          });

          if (updated.count === 0) {
            throw new Error('Stock was modified by another transaction. Retrying...');
          }

          this.logger.log(
            `Stock updated for product ${productId}: ${operation} ${quantity} (new stock: ${newStock})`,
          );
        }, {
          isolationLevel: 'Serializable', // Highest isolation level
          maxWait: 5000, // Wait up to 5s for transaction to start
          timeout: 10000, // Transaction timeout 10s
        });

        return; // Success, exit
      } catch (error) {
        if (
          error.message.includes('modified by another transaction') &&
          retries < maxRetries - 1
        ) {
          retries++;
          this.logger.warn(
            `Stock update conflict for product ${productId}, retrying (${retries}/${maxRetries})...`,
          );
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 100 * retries));
        } else {
          this.logger.error(`Failed to update stock: ${error.message}`, error.stack);
          throw error;
        }
      }
    }

    throw new Error(`Failed to update stock after ${maxRetries} retries`);
  }

  /**
   * Create product variant
   */
  async createVariant(variant: Partial<ProductVariant>): Promise<ProductVariant> {
    try {
      const created = await this.prisma.product_variants.create({
        data: {
          ...variant,
          in_stock: variant.in_stock ?? (variant.quantity || 0) > 0,
        } as any,
      });

      this.logger.log(`Variant created: ${created.variant_id} for product ${variant.product_id}`);
      return this.toDomainVariant(created);
    } catch (error) {
      this.logger.error(`Failed to create variant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all variants for a product
   */
  async findVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    try {
      const variants = await this.prisma.product_variants.findMany({
        where: { product_id: productId },
        orderBy: { created_at: 'asc' },
      });

      return variants.map(v => this.toDomainVariant(v));
    } catch (error) {
      this.logger.error(`Failed to find variants: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update product variant
   */
  async updateVariant(variantId: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
    try {
      // Update in_stock if quantity changed
      if (data.quantity !== undefined) {
        data.in_stock = data.quantity > 0;
      }

      const updated = await this.prisma.product_variants.update({
        where: { variant_id: variantId },
        data: data as any,
      });

      this.logger.log(`Variant updated: ${updated.variant_id}`);
      return this.toDomainVariant(updated);
    } catch (error) {
      this.logger.error(`Failed to update variant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete product variant
   */
  async deleteVariant(variantId: string): Promise<void> {
    try {
      await this.prisma.product_variants.delete({
        where: { variant_id: variantId },
      });

      this.logger.log(`Variant deleted: ${variantId}`);
    } catch (error) {
      this.logger.error(`Failed to delete variant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate URL-friendly slug from product name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Convert Prisma product to domain entity
   * Handles Decimal to number conversion
   */
  private toDomainProduct(prismaProduct: any): Product {
    return {
      ...prismaProduct,
      price: prismaProduct.price ? Number(prismaProduct.price) : undefined,
      compare_price: prismaProduct.compare_price ? Number(prismaProduct.compare_price) : undefined,
    } as Product;
  }

  /**
   * Convert Prisma variant to domain entity
   * Handles Decimal to number conversion
   */
  private toDomainVariant(prismaVariant: any): ProductVariant {
    return {
      ...prismaVariant,
      price: Number(prismaVariant.price),
    } as ProductVariant;
  }
}
