import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CategoryRepositoryPrisma } from '../../infrastructure/category.repository.prisma';
import { Category } from '../../domain/entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly categoryRepository: CategoryRepositoryPrisma) {}

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      // Generate slug from name
      const slug = this.generateSlug(createCategoryDto.name);

      // Check if slug already exists
      const existingCategory = await this.categoryRepository.findBySlug(
        slug,
        createCategoryDto.business_id,
      );

      if (existingCategory) {
        throw new ConflictException(
          `Category with name "${createCategoryDto.name}" already exists`,
        );
      }

      // Determine level and path
      let level = 0;
      let path = slug;

      if (createCategoryDto.parent_category_id) {
        const parent = await this.categoryRepository.findById(
          createCategoryDto.parent_category_id,
        );

        if (!parent) {
          throw new NotFoundException('Parent category not found');
        }

        if (parent.level >= 4) {
          throw new BadRequestException('Maximum category depth (5 levels) reached');
        }

        level = parent.level + 1;
        path = `${parent.path}/${slug}`;
      }

      const category = await this.categoryRepository.create({
        ...createCategoryDto,
        slug,
        level,
        path,
        display_order: createCategoryDto.display_order || 0,
        is_active: createCategoryDto.is_active ?? true,
        product_count: 0,
      });

      this.logger.log(`Category created: ${category.category_id} - ${category.name}`);
      return category;
    } catch (error) {
      this.logger.error(`Failed to create category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all categories for a business
   */
  async findAll(businessId: string): Promise<Category[]> {
    try {
      const categories = await this.categoryRepository.findAllByBusiness(businessId);
      this.logger.log(`Retrieved ${categories.length} categories for business ${businessId}`);
      return categories;
    } catch (error) {
      this.logger.error(`Failed to find categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getTree(businessId: string): Promise<Category[]> {
    try {
      const categories = await this.categoryRepository.findAllByBusiness(businessId);

      // Build tree structure
      const tree = this.buildTree(categories);

      this.logger.log(`Built category tree for business ${businessId}`);
      return tree;
    } catch (error) {
      this.logger.error(`Failed to build category tree: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async findById(categoryId: string): Promise<Category> {
    try {
      const category = await this.categoryRepository.findById(categoryId);

      if (!category) {
        throw new NotFoundException(`Category not found: ${categoryId}`);
      }

      return category;
    } catch (error) {
      this.logger.error(`Failed to find category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  async findBySlug(slug: string, businessId: string): Promise<Category> {
    try {
      const category = await this.categoryRepository.findBySlug(slug, businessId);

      if (!category) {
        throw new NotFoundException(`Category not found: ${slug}`);
      }

      return category;
    } catch (error) {
      this.logger.error(`Failed to find category by slug: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update category
   */
  async update(
    categoryId: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    try {
      const existingCategory = await this.categoryRepository.findById(categoryId);

      if (!existingCategory) {
        throw new NotFoundException(`Category not found: ${categoryId}`);
      }

      // If name changed, regenerate slug
      let slug = existingCategory.slug;
      if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
        slug = this.generateSlug(updateCategoryDto.name);

        // Check if new slug already exists
        const conflictingCategory = await this.categoryRepository.findBySlug(
          slug,
          existingCategory.business_id,
        );

        if (conflictingCategory && conflictingCategory.category_id !== categoryId) {
          throw new ConflictException(
            `Category with name "${updateCategoryDto.name}" already exists`,
          );
        }
      }

      const updated = await this.categoryRepository.update(categoryId, {
        ...updateCategoryDto,
        slug,
      });

      this.logger.log(`Category updated: ${updated.category_id}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete category
   */
  async delete(categoryId: string, hardDelete: boolean = false): Promise<void> {
    try {
      const category = await this.categoryRepository.findById(categoryId);

      if (!category) {
        throw new NotFoundException(`Category not found: ${categoryId}`);
      }

      // Check if category has children
      const children = await this.categoryRepository.findChildren(categoryId);
      if (children.length > 0) {
        throw new BadRequestException(
          `Cannot delete category with ${children.length} subcategories. Delete children first.`,
        );
      }

      if (hardDelete) {
        await this.categoryRepository.hardDelete(categoryId);
        this.logger.log(`Category hard deleted: ${categoryId}`);
      } else {
        await this.categoryRepository.delete(categoryId);
        this.logger.log(`Category soft deleted: ${categoryId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Move category to a different parent
   */
  async moveCategory(categoryId: string, newParentId: string | null): Promise<Category> {
    try {
      const category = await this.categoryRepository.findById(categoryId);

      if (!category) {
        throw new NotFoundException(`Category not found: ${categoryId}`);
      }

      let newLevel = 0;
      let newPath = category.slug;

      if (newParentId) {
        const newParent = await this.categoryRepository.findById(newParentId);

        if (!newParent) {
          throw new NotFoundException('New parent category not found');
        }

        // Prevent moving to own descendant
        if (newParent.path?.startsWith(`${category.path}/`)) {
          throw new BadRequestException('Cannot move category to its own descendant');
        }

        if (newParent.level >= 4) {
          throw new BadRequestException('Maximum category depth (5 levels) reached');
        }

        newLevel = newParent.level + 1;
        newPath = `${newParent.path}/${category.slug}`;
      }

      const updated = await this.categoryRepository.update(categoryId, {
        parent_category_id: newParentId,
        level: newLevel,
        path: newPath,
      });

      // Update all descendants' paths
      await this.updateDescendantsPaths(categoryId, newPath);

      this.logger.log(`Category moved: ${categoryId} to parent ${newParentId}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to move category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Build hierarchical tree from flat category list
   */
  private buildTree(categories: Category[], parentId: string | null = null): Category[] {
    const tree: Category[] = [];

    for (const category of categories) {
      if (category.parent_category_id === parentId) {
        const children = this.buildTree(categories, category.category_id);
        if (children.length > 0) {
          category.children = children;
        }
        tree.push(category);
      }
    }

    return tree;
  }

  /**
   * Update paths for all descendant categories
   */
  private async updateDescendantsPaths(
    categoryId: string,
    newPath: string,
  ): Promise<void> {
    const children = await this.categoryRepository.findChildren(categoryId);

    for (const child of children) {
      const childNewPath = `${newPath}/${child.slug}`;
      await this.categoryRepository.update(child.category_id, {
        path: childNewPath,
        level: newPath.split('/').length,
      });

      // Recursively update grandchildren
      await this.updateDescendantsPaths(child.category_id, childNewPath);
    }
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
