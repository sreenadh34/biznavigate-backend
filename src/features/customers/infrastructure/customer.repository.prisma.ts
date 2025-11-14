import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Customer } from '../domain/entities/customer.entity';
import { CustomerQueryDto } from '../application/dto/customer-query.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Customer Repository Interface
 * Defines contract for customer data access
 */
export interface ICustomerRepository {
  create(customer: Partial<Customer>): Promise<Customer>;
  findById(customerId: string): Promise<Customer | null>;
  findByPhone(businessId: string, phone: string): Promise<Customer | null>;
  findByEmail(businessId: string, email: string): Promise<Customer | null>;
  findAll(query: CustomerQueryDto): Promise<{ data: Customer[]; total: number; page: number; limit: number }>;
  update(customerId: string, data: Partial<Customer>): Promise<Customer>;
  delete(customerId: string): Promise<void>;
  updateEngagementScore(customerId: string, score: number): Promise<void>;
  updateOrderStats(customerId: string, totalOrders: number, totalSpent: number, lastOrderDate: Date): Promise<void>;
  getTopCustomers(businessId: string, limit: number, sortBy: 'total_spent' | 'total_orders'): Promise<Customer[]>;
}

/**
 * Prisma implementation of Customer Repository
 * Handles all database operations for customers
 * Production-ready with proper indexing and error handling
 */
@Injectable()
export class CustomerRepositoryPrisma implements ICustomerRepository {
  private readonly logger = new Logger(CustomerRepositoryPrisma.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new customer
   */
  async create(customer: Partial<Customer>): Promise<Customer> {
    try {
      const created = await this.prisma.customers.create({
        data: {
          business_id: customer.business_id,
          tenant_id: customer.tenant_id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          whatsapp_number: customer.whatsapp_number,
          total_orders: customer.total_orders ?? 0,
          total_spent: customer.total_spent ?? 0,
          engagement_score: customer.engagement_score ?? 0,
          last_order_date: customer.last_order_date,
        } as any,
      });

      this.logger.log(`Customer created: ${created.customer_id} - ${created.phone}`);
      return this.toDomainCustomer(created);
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find customer by ID
   */
  async findById(customerId: string): Promise<Customer | null> {
    try {
      const customer = await this.prisma.customers.findUnique({
        where: { customer_id: customerId },
      });

      return customer ? this.toDomainCustomer(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find customer by phone number (within a business)
   * Important for duplicate detection
   */
  async findByPhone(businessId: string, phone: string): Promise<Customer | null> {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: {
          business_id: businessId,
          phone: phone,
        },
      });

      return customer ? this.toDomainCustomer(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer by phone: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find customer by email (within a business)
   */
  async findByEmail(businessId: string, email: string): Promise<Customer | null> {
    try {
      if (!email) return null;

      const customer = await this.prisma.customers.findFirst({
        where: {
          business_id: businessId,
          email: email,
        },
      });

      return customer ? this.toDomainCustomer(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer by email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all customers with filtering, pagination, and sorting
   * Optimized for large datasets (thousands of customers)
   */
  async findAll(
    query: CustomerQueryDto,
  ): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
    try {
      const {
        business_id,
        search,
        min_total_spent,
        max_total_spent,
        min_total_orders,
        max_total_orders,
        min_engagement_score,
        max_engagement_score,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        order = 'desc',
      } = query;

      // Build where clause
      const where: any = {};

      if (business_id) {
        where.business_id = business_id;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (min_total_spent !== undefined || max_total_spent !== undefined) {
        where.total_spent = {};
        if (min_total_spent !== undefined) {
          where.total_spent.gte = min_total_spent;
        }
        if (max_total_spent !== undefined) {
          where.total_spent.lte = max_total_spent;
        }
      }

      if (min_total_orders !== undefined || max_total_orders !== undefined) {
        where.total_orders = {};
        if (min_total_orders !== undefined) {
          where.total_orders.gte = min_total_orders;
        }
        if (max_total_orders !== undefined) {
          where.total_orders.lte = max_total_orders;
        }
      }

      if (min_engagement_score !== undefined || max_engagement_score !== undefined) {
        where.engagement_score = {};
        if (min_engagement_score !== undefined) {
          where.engagement_score.gte = min_engagement_score;
        }
        if (max_engagement_score !== undefined) {
          where.engagement_score.lte = max_engagement_score;
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Fetch customers and total count in parallel (performance optimization)
      const [customers, total] = await Promise.all([
        this.prisma.customers.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sort_by]: order },
        }),
        this.prisma.customers.count({ where }),
      ]);

      this.logger.log(`Found ${customers.length} customers (total: ${total})`);

      return {
        data: customers.map(c => this.toDomainCustomer(c)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to find customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update customer
   */
  async update(customerId: string, data: Partial<Customer>): Promise<Customer> {
    try {
      const updated = await this.prisma.customers.update({
        where: { customer_id: customerId },
        data: data as any,
      });

      this.logger.log(`Customer updated: ${updated.customer_id}`);
      return this.toDomainCustomer(updated);
    } catch (error) {
      this.logger.error(`Failed to update customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete customer (hard delete as per schema - customers table doesn't have soft delete)
   * Consider: Might want to add is_active field in future for soft delete
   */
  async delete(customerId: string): Promise<void> {
    try {
      await this.prisma.customers.delete({
        where: { customer_id: customerId },
      });

      this.logger.log(`Customer deleted: ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to delete customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update engagement score
   * Called when customer interacts (messages, orders, etc.)
   */
  async updateEngagementScore(customerId: string, score: number): Promise<void> {
    try {
      await this.prisma.customers.update({
        where: { customer_id: customerId },
        data: { engagement_score: score },
      });

      this.logger.log(`Engagement score updated for customer ${customerId}: ${score}`);
    } catch (error) {
      this.logger.error(`Failed to update engagement score: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update order statistics
   * Called when customer places or cancels an order
   */
  async updateOrderStats(
    customerId: string,
    totalOrders: number,
    totalSpent: number,
    lastOrderDate: Date,
  ): Promise<void> {
    try {
      await this.prisma.customers.update({
        where: { customer_id: customerId },
        data: {
          total_orders: totalOrders,
          total_spent: totalSpent,
          last_order_date: lastOrderDate,
        },
      });

      this.logger.log(
        `Order stats updated for customer ${customerId}: ${totalOrders} orders, ₹${totalSpent}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update order stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get top customers (VIP customers)
   * Useful for targeted campaigns and rewards
   */
  async getTopCustomers(
    businessId: string,
    limit: number,
    sortBy: 'total_spent' | 'total_orders' = 'total_spent',
  ): Promise<Customer[]> {
    try {
      const customers = await this.prisma.customers.findMany({
        where: { business_id: businessId },
        orderBy: { [sortBy]: 'desc' },
        take: limit,
      });

      this.logger.log(`Retrieved top ${customers.length} customers by ${sortBy}`);

      return customers.map(c => this.toDomainCustomer(c));
    } catch (error) {
      this.logger.error(`Failed to get top customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Convert Prisma customer to domain entity
   * Handles Decimal to number conversion
   */
  private toDomainCustomer(prismaCustomer: any): Customer {
    return {
      ...prismaCustomer,
      total_spent: prismaCustomer.total_spent
        ? Number(prismaCustomer.total_spent)
        : 0,
    } as Customer;
  }
}
