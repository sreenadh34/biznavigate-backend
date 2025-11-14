import { Module } from '@nestjs/common';
import { ProductController } from './application/controllers/product.controller';
import { ProductService } from './application/services/product.service';
import { ProductRepositoryPrisma } from './infrastructure/product.repository.prisma';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Products Module
 * Complete product management system for e-commerce
 * Supports physical products, courses, events, and services
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProductController],
  providers: [ProductService, ProductRepositoryPrisma],
  exports: [ProductService, ProductRepositoryPrisma],
})
export class ProductsModule {}
