import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { BulkUploadProductDto } from '../dto/bulk-upload-product.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/**
 * Product Controller
 * Handles all HTTP endpoints for product management
 * All endpoints require JWT authentication
 */
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  /**
   * Create a new product
   * POST /products
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProductDto: CreateProductDto) {
    this.logger.log(`Creating product: ${createProductDto.name}`);

    const product = await this.productService.create(createProductDto);

    return {
      success: true,
      message: 'Product created successfully',
      data: product,
    };
  }

  /**
   * Get all products with filtering, pagination, and sorting
   * GET /products
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: ProductQueryDto) {
    this.logger.log(
      `Fetching products with filters: ${JSON.stringify(query)}`,
    );

    const result = await this.productService.findAll(query);

    return {
      success: true,
      message: 'Products retrieved successfully',
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  /**
   * Get product by ID
   * GET /products/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    this.logger.log(`Fetching product: ${id}`);

    const product = await this.productService.findById(id);

    return {
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    };
  }

  /**
   * Update product
   * PUT /products/:id
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    this.logger.log(`Updating product: ${id}`);

    const product = await this.productService.update(id, updateProductDto);

    return {
      success: true,
      message: 'Product updated successfully',
      data: product,
    };
  }

  /**
   * Delete product (soft delete)
   * DELETE /products/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    this.logger.log(`Deleting product: ${id}`);

    await this.productService.delete(id);

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }

  /**
   * Bulk upload products
   * POST /products/bulk
   */
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(@Body() bulkUploadDto: BulkUploadProductDto) {
    this.logger.log(
      `Bulk uploading ${bulkUploadDto.products.length} products`,
    );

    const result = await this.productService.bulkCreate(bulkUploadDto);

    return {
      success: true,
      message: 'Bulk upload completed',
      data: {
        totalProcessed: bulkUploadDto.products.length,
        successCount: result.success,
        failedCount: result.failed,
        errors: result.errors,
      },
    };
  }

  /**
   * Check stock availability
   * GET /products/:id/stock/check
   */
  @Get(':id/stock/check')
  @HttpCode(HttpStatus.OK)
  async checkStockAvailability(
    @Param('id') id: string,
    @Query('quantity') quantity: number,
  ) {
    this.logger.log(`Checking stock for product ${id}: quantity ${quantity}`);

    const available = await this.productService.checkStockAvailability(
      id,
      Number(quantity),
    );

    return {
      success: true,
      message: 'Stock availability checked',
      data: {
        product_id: id,
        requested_quantity: Number(quantity),
        available,
      },
    };
  }

  /**
   * Update stock (increment/decrement)
   * POST /products/:id/stock/update
   */
  @Post(':id/stock/update')
  @HttpCode(HttpStatus.OK)
  async updateStock(
    @Param('id') id: string,
    @Body() body: { quantity: number; operation: 'increment' | 'decrement' },
  ) {
    this.logger.log(
      `Updating stock for product ${id}: ${body.operation} ${body.quantity}`,
    );

    await this.productService.updateStock(id, body.quantity, body.operation);

    return {
      success: true,
      message: `Stock ${body.operation}ed successfully`,
      data: {
        product_id: id,
        quantity: body.quantity,
        operation: body.operation,
      },
    };
  }

  /**
   * Reserve stock (for order processing)
   * POST /products/:id/stock/reserve
   */
  @Post(':id/stock/reserve')
  @HttpCode(HttpStatus.OK)
  async reserveStock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    this.logger.log(`Reserving stock for product ${id}: ${body.quantity}`);

    await this.productService.reserveStock(id, body.quantity);

    return {
      success: true,
      message: 'Stock reserved successfully',
      data: {
        product_id: id,
        reserved_quantity: body.quantity,
      },
    };
  }

  /**
   * Release stock (for order cancellations)
   * POST /products/:id/stock/release
   */
  @Post(':id/stock/release')
  @HttpCode(HttpStatus.OK)
  async releaseStock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    this.logger.log(`Releasing stock for product ${id}: ${body.quantity}`);

    await this.productService.releaseStock(id, body.quantity);

    return {
      success: true,
      message: 'Stock released successfully',
      data: {
        product_id: id,
        released_quantity: body.quantity,
      },
    };
  }

  /**
   * Create product variant
   * POST /products/:id/variants
   */
  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  async createVariant(
    @Param('id') productId: string,
    @Body() variantData: any,
  ) {
    this.logger.log(`Creating variant for product ${productId}`);

    const variant = await this.productService.createVariant(
      productId,
      variantData,
    );

    return {
      success: true,
      message: 'Variant created successfully',
      data: variant,
    };
  }

  /**
   * Get all variants for a product
   * GET /products/:id/variants
   */
  @Get(':id/variants')
  @HttpCode(HttpStatus.OK)
  async getVariants(@Param('id') productId: string) {
    this.logger.log(`Fetching variants for product ${productId}`);

    const variants = await this.productService.getVariantsByProductId(
      productId,
    );

    return {
      success: true,
      message: 'Variants retrieved successfully',
      data: variants,
    };
  }

  /**
   * Update product variant
   * PUT /products/variants/:variantId
   */
  @Put('variants/:variantId')
  @HttpCode(HttpStatus.OK)
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() variantData: any,
  ) {
    this.logger.log(`Updating variant ${variantId}`);

    const variant = await this.productService.updateVariant(
      variantId,
      variantData,
    );

    return {
      success: true,
      message: 'Variant updated successfully',
      data: variant,
    };
  }

  /**
   * Delete product variant
   * DELETE /products/variants/:variantId
   */
  @Delete('variants/:variantId')
  @HttpCode(HttpStatus.OK)
  async deleteVariant(@Param('variantId') variantId: string) {
    this.logger.log(`Deleting variant ${variantId}`);

    await this.productService.deleteVariant(variantId);

    return {
      success: true,
      message: 'Variant deleted successfully',
    };
  }
}
