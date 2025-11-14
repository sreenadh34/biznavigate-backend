import { Module } from '@nestjs/common';
import { CustomerController } from './application/controllers/customer.controller';
import { CustomerService } from './application/services/customer.service';
import { CustomerRepositoryPrisma } from './infrastructure/customer.repository.prisma';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Customers Module
 * Manages customer data, engagement tracking, and segmentation
 * Production-ready module for handling thousands of customers
 */
@Module({
  imports: [PrismaModule],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerRepositoryPrisma,
  ],
  exports: [CustomerService, CustomerRepositoryPrisma],
})
export class CustomersModule {}
