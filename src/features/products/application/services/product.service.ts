import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProductRepositoryPrisma } from '../../infrastructure/product.repository.prisma';
import { Product, ProductVariant } from '../../domain/entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { BulkUploadProductDto } from '../dto/bulk-upload-product.dto';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Product Service
 * Handles all business logic for product management
 * Production-grade service designed for scalability and reliability
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly productRepository: ProductRepositoryPrisma,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new product
   * Validates business exists and SKU uniqueness
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      // Validate business exists
      await this.validateBusinessExists(createProductDto.business_id);

      // Validate SKU uniqueness within business if provided
      if (createProductDto.sku) {
        await this.validateSkuUniqueness(
          createProductDto.business_id,
          createProductDto.sku,
        );
      }

      // Validate compare_price is greater than price if both provided
      if (
        createProductDto.compare_price !== undefined &&
        createProductDto.price !== undefined &&
        createProductDto.compare_price <= createProductDto.price
      ) {
        throw new BadRequestException(
          'Compare price must be greater than selling price',
        );
      }

      // Create product
      const product = await this.productRepository.create(createProductDto);

      // Create variants if provided
      if (
        createProductDto.has_variants &&
        createProductDto.variants &&
        createProductDto.variants.length > 0
      ) {
        for (const variantDto of createProductDto.variants) {
          await this.productRepository.createVariant({
            ...variantDto,
            product_id: product.product_id,
          });
        }
      }

      this.logger.log(
        `Product created successfully: ${product.product_id} for business ${createProductDto.business_id}`,
      );

      return product;
    } catch (error) {
      this.logger.error(
        `Failed to create product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find product by ID with variants
   */
  async findById(productId: string): Promise<Product & { variants?: ProductVariant[] }> {
    try {
      const product = await this.productRepository.findById(productId);

      if (!product) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      // Fetch variants if product has variants
      let variants: ProductVariant[] = [];
      if (product.has_variants) {
        variants = await this.productRepository.findVariantsByProductId(productId);
      }

      return {
        ...product,
        variants: variants.length > 0 ? variants : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to find product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find all products with filtering, pagination, and sorting
   */
  async findAll(
    query: ProductQueryDto,
  ): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    try {
      // Validate business exists if business_id filter provided
      if (query.business_id) {
        await this.validateBusinessExists(query.business_id);
      }

      const result = await this.productRepository.findAll(query);

      this.logger.log(
        `Retrieved ${result.data.length} products (page ${result.page}/${Math.ceil(result.total / result.limit)})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to find products: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update product
   */
  async update(
    productId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    try {
      // Check if product exists
      const existingProduct = await this.productRepository.findById(productId);
      if (!existingProduct) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      // Validate SKU uniqueness if SKU is being updated
      if (
        updateProductDto.sku &&
        updateProductDto.sku !== existingProduct.sku
      ) {
        await this.validateSkuUniqueness(
          existingProduct.business_id,
          updateProductDto.sku,
          productId,
        );
      }

      // Validate compare_price is greater than price if both provided
      const newPrice = updateProductDto.price ?? existingProduct.price;
      const newComparePrice =
        updateProductDto.compare_price ?? existingProduct.compare_price;

      if (
        newComparePrice !== undefined &&
        newComparePrice !== null &&
        newPrice !== undefined &&
        newPrice !== null &&
        newComparePrice <= newPrice
      ) {
        throw new BadRequestException(
          'Compare price must be greater than selling price',
        );
      }

      const updated = await this.productRepository.update(
        productId,
        updateProductDto,
      );

      this.logger.log(`Product updated successfully: ${productId}`);

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete product (soft delete)
   */
  async delete(productId: string): Promise<void> {
    try {
      // Check if product exists
      const existingProduct = await this.productRepository.findById(productId);
      if (!existingProduct) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      await this.productRepository.delete(productId);

      this.logger.log(`Product soft deleted successfully: ${productId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Bulk create products
   * Uses transaction for data integrity
   */
  async bulkCreate(
    bulkUploadDto: BulkUploadProductDto,
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ index: number; sku?: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ index: number; sku?: string; error: string }>,
    };

    this.logger.log(
      `Starting bulk upload of ${bulkUploadDto.products.length} products`,
    );

    for (let i = 0; i < bulkUploadDto.products.length; i++) {
      const productDto = bulkUploadDto.products[i];

      try {
        // Validate business exists
        await this.validateBusinessExists(productDto.business_id);

        // Validate SKU uniqueness if provided
        if (productDto.sku) {
          await this.validateSkuUniqueness(
            productDto.business_id,
            productDto.sku,
          );
        }

        // Create product
        await this.productRepository.create(productDto);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          sku: productDto.sku,
          error: error.message,
        });

        this.logger.warn(
          `Failed to create product at index ${i} (SKU: ${productDto.sku}): ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Bulk upload completed: ${results.success} succeeded, ${results.failed} failed`,
    );

    return results;
  }

  /**
   * Check stock availability
   */
  async checkStockAvailability(
    productId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      const available = await this.productRepository.checkStockAvailability(
        productId,
        quantity,
      );

      this.logger.log(
        `Stock check for product ${productId} (qty: ${quantity}): ${available ? 'available' : 'unavailable'}`,
      );

      return available;
    } catch (error) {
      this.logger.error(
        `Failed to check stock availability: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Update stock (increment or decrement)
   * Used for inventory adjustments and order processing
   */
  async updateStock(
    productId: string,
    quantity: number,
    operation: 'increment' | 'decrement',
  ): Promise<void> {
    try {
      // Check if product exists
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      // If decrementing, check stock availability
      if (operation === 'decrement' && product.track_inventory) {
        const available = await this.productRepository.checkStockAvailability(
          productId,
          quantity,
        );

        if (!available) {
          throw new BadRequestException(
            `Insufficient stock for product ${productId}. Requested: ${quantity}, Available: ${product.stock_quantity || 0}`,
          );
        }
      }

      await this.productRepository.updateStock(productId, quantity, operation);

      this.logger.log(
        `Stock ${operation}ed for product ${productId}: ${quantity} units`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update stock: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Reserve stock for order (decrement)
   */
  async reserveStock(productId: string, quantity: number): Promise<void> {
    return this.updateStock(productId, quantity, 'decrement');
  }

  /**
   * Release stock (increment) - for order cancellations
   */
  async releaseStock(productId: string, quantity: number): Promise<void> {
    return this.updateStock(productId, quantity, 'increment');
  }

  /**
   * Create product variant
   */
  async createVariant(
    productId: string,
    variantData: Partial<ProductVariant>,
  ): Promise<ProductVariant> {
    try {
      // Check if product exists
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      // Ensure product has variants enabled
      if (!product.has_variants) {
        throw new BadRequestException(
          `Product ${productId} does not support variants. Enable has_variants first.`,
        );
      }

      const variant = await this.productRepository.createVariant({
        ...variantData,
        product_id: productId,
      });

      this.logger.log(
        `Variant created: ${variant.variant_id} for product ${productId}`,
      );

      return variant;
    } catch (error) {
      this.logger.error(
        `Failed to create variant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all variants for a product
   */
  async getVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    try {
      // Check if product exists
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundException(`Product not found: ${productId}`);
      }

      const variants =
        await this.productRepository.findVariantsByProductId(productId);

      this.logger.log(`Retrieved ${variants.length} variants for product ${productId}`);

      return variants;
    } catch (error) {
      this.logger.error(
        `Failed to get variants: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update product variant
   */
  async updateVariant(
    variantId: string,
    variantData: Partial<ProductVariant>,
  ): Promise<ProductVariant> {
    try {
      const updated = await this.productRepository.updateVariant(
        variantId,
        variantData,
      );

      this.logger.log(`Variant updated: ${variantId}`);

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update variant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete product variant
   */
  async deleteVariant(variantId: string): Promise<void> {
    try {
      await this.productRepository.deleteVariant(variantId);

      this.logger.log(`Variant deleted: ${variantId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete variant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate business exists
   */
  private async validateBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.businesses.findUnique({
      where: { business_id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business not found: ${businessId}`);
    }
  }

  /**
   * Validate SKU uniqueness within a business
   */
  private async validateSkuUniqueness(
    businessId: string,
    sku: string,
    excludeProductId?: string,
  ): Promise<void> {
    const existingProduct = await this.prisma.products.findFirst({
      where: {
        business_id: businessId,
        sku,
        product_id: excludeProductId ? { not: excludeProductId } : undefined,
      },
    });

    if (existingProduct) {
      throw new ConflictException(
        `Product with SKU "${sku}" already exists in this business`,
      );
    }
  }
}
