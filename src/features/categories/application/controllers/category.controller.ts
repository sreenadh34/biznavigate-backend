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
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/**
 * Category Controller
 * Handles all HTTP endpoints for category management
 */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Create a new category
   * POST /categories
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    this.logger.log(`Creating category: ${createCategoryDto.name}`);

    const category = await this.categoryService.create(createCategoryDto);

    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  /**
   * Get all categories for a business
   * GET /categories?business_id=xxx
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('business_id') businessId: string) {
    this.logger.log(`Fetching categories for business: ${businessId}`);

    const categories = await this.categoryService.findAll(businessId);

    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }

  /**
   * Get category tree (hierarchical)
   * GET /categories/tree?business_id=xxx
   */
  @Get('tree')
  @HttpCode(HttpStatus.OK)
  async getTree(@Query('business_id') businessId: string) {
    this.logger.log(`Building category tree for business: ${businessId}`);

    const tree = await this.categoryService.getTree(businessId);

    return {
      success: true,
      message: 'Category tree retrieved successfully',
      data: tree,
    };
  }

  /**
   * Get category by ID
   * GET /categories/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    this.logger.log(`Fetching category: ${id}`);

    const category = await this.categoryService.findById(id);

    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  /**
   * Get category by slug
   * GET /categories/slug/:slug?business_id=xxx
   */
  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  async findBySlug(
    @Param('slug') slug: string,
    @Query('business_id') businessId: string,
  ) {
    this.logger.log(`Fetching category by slug: ${slug}`);

    const category = await this.categoryService.findBySlug(slug, businessId);

    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  /**
   * Update category
   * PUT /categories/:id
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    this.logger.log(`Updating category: ${id}`);

    const category = await this.categoryService.update(id, updateCategoryDto);

    return {
      success: true,
      message: 'Category updated successfully',
      data: category,
    };
  }

  /**
   * Delete category (soft delete)
   * DELETE /categories/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Query('hard') hard?: string) {
    this.logger.log(`Deleting category: ${id}`);

    const hardDelete = hard === 'true';
    await this.categoryService.delete(id, hardDelete);

    return {
      success: true,
      message: hardDelete
        ? 'Category permanently deleted'
        : 'Category deleted successfully',
    };
  }

  /**
   * Move category to a different parent
   * PUT /categories/:id/move
   */
  @Put(':id/move')
  @HttpCode(HttpStatus.OK)
  async move(
    @Param('id') id: string,
    @Body('new_parent_id') newParentId: string | null,
  ) {
    this.logger.log(`Moving category ${id} to parent ${newParentId}`);

    const category = await this.categoryService.moveCategory(id, newParentId);

    return {
      success: true,
      message: 'Category moved successfully',
      data: category,
    };
  }
}
