import { Module } from '@nestjs/common';
import { CategoryController } from './application/controllers/category.controller';
import { CategoryService } from './application/services/category.service';
import { CategoryRepositoryPrisma } from './infrastructure/category.repository.prisma';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Categories Module
 * Manages hierarchical product categories
 */
@Module({
  imports: [PrismaModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepositoryPrisma],
  exports: [CategoryService, CategoryRepositoryPrisma],
})
export class CategoriesModule {}
