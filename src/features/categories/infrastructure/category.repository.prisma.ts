import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Category } from '../domain/entities/category.entity';

@Injectable()
export class CategoryRepositoryPrisma {
  private readonly logger = new Logger(CategoryRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new category
   */
  async create(data: Partial<Category>): Promise<Category> {
    try {
      const created = await this.prisma.product_categories.create({
        data: data as any,
      });

      this.logger.log(`Category created: ${created.category_id} - ${created.name}`);
      return this.toDomain(created);
    } catch (error) {
      this.logger.error(`Failed to create category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all categories for a business
   */
  async findAllByBusiness(businessId: string): Promise<Category[]> {
    try {
      const categories = await this.prisma.product_categories.findMany({
        where: { business_id: businessId },
        orderBy: [{ level: 'asc' }, { display_order: 'asc' }, { name: 'asc' }],
      });

      return categories.map((c) => this.toDomain(c));
    } catch (error) {
      this.logger.error(`Failed to find categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find category by ID
   */
  async findById(categoryId: string): Promise<Category | null> {
    try {
      const category = await this.prisma.product_categories.findUnique({
        where: { category_id: categoryId },
      });

      return category ? this.toDomain(category) : null;
    } catch (error) {
      this.logger.error(`Failed to find category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string, businessId: string): Promise<Category | null> {
    try {
      const category = await this.prisma.product_categories.findFirst({
        where: {
          slug,
          business_id: businessId,
        },
      });

      return category ? this.toDomain(category) : null;
    } catch (error) {
      this.logger.error(`Failed to find category by slug: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find children categories
   */
  async findChildren(parentCategoryId: string): Promise<Category[]> {
    try {
      const categories = await this.prisma.product_categories.findMany({
        where: { parent_category_id: parentCategoryId },
        orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
      });

      return categories.map((c) => this.toDomain(c));
    } catch (error) {
      this.logger.error(`Failed to find child categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update category
   */
  async update(categoryId: string, data: Partial<Category>): Promise<Category> {
    try {
      const updated = await this.prisma.product_categories.update({
        where: { category_id: categoryId },
        data: {
          ...data,
          updated_at: new Date(),
        } as any,
      });

      this.logger.log(`Category updated: ${updated.category_id}`);
      return this.toDomain(updated);
    } catch (error) {
      this.logger.error(`Failed to update category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete category (soft delete)
   */
  async delete(categoryId: string): Promise<void> {
    try {
      await this.prisma.product_categories.update({
        where: { category_id: categoryId },
        data: { is_active: false },
      });

      this.logger.log(`Category soft deleted: ${categoryId}`);
    } catch (error) {
      this.logger.error(`Failed to delete category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Hard delete category
   */
  async hardDelete(categoryId: string): Promise<void> {
    try {
      // Set category_id to null for all products using this category
      await this.prisma.products.updateMany({
        where: { category_id: categoryId },
        data: { category_id: null },
      });

      // Delete the category
      await this.prisma.product_categories.delete({
        where: { category_id: categoryId },
      });

      this.logger.log(`Category hard deleted: ${categoryId}`);
    } catch (error) {
      this.logger.error(`Failed to hard delete category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomain(model: any): Category {
    return {
      category_id: model.category_id,
      business_id: model.business_id,
      tenant_id: model.tenant_id,
      name: model.name,
      slug: model.slug,
      description: model.description,
      parent_category_id: model.parent_category_id,
      level: model.level,
      path: model.path,
      icon_url: model.icon_url,
      image_url: model.image_url,
      display_order: model.display_order,
      meta_title: model.meta_title,
      meta_description: model.meta_description,
      is_active: model.is_active,
      product_count: model.product_count,
      created_at: model.created_at,
      updated_at: model.updated_at,
      created_by: model.created_by,
    };
  }
}
