import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CustomerRepositoryPrisma } from '../../infrastructure/customer.repository.prisma';
import { Customer } from '../../domain/entities/customer.entity';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { BulkUploadCustomerDto } from '../dto/bulk-upload-customer.dto';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Customer Service
 * Handles all business logic for customer management
 * Production-grade service designed for scalability and thousands of users
 */
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly customerRepository: CustomerRepositoryPrisma,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new customer
   * Includes duplicate detection by phone
   */
  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    try {
      // Validate business exists
      await this.validateBusinessExists(createCustomerDto.business_id);

      // Check for duplicate phone number within business
      const existingByPhone = await this.customerRepository.findByPhone(
        createCustomerDto.business_id,
        createCustomerDto.phone,
      );

      if (existingByPhone) {
        throw new ConflictException(
          `Customer with phone ${createCustomerDto.phone} already exists`,
        );
      }

      // Check for duplicate email if provided
      if (createCustomerDto.email) {
        const existingByEmail = await this.customerRepository.findByEmail(
          createCustomerDto.business_id,
          createCustomerDto.email,
        );

        if (existingByEmail) {
          throw new ConflictException(
            `Customer with email ${createCustomerDto.email} already exists`,
          );
        }
      }

      // If whatsapp_number not provided, use phone as default
      if (!createCustomerDto.whatsapp_number) {
        createCustomerDto.whatsapp_number = createCustomerDto.phone;
      }

      // Create customer with initial values
      const customer = await this.customerRepository.create({
        ...createCustomerDto,
        total_orders: 0,
        total_spent: 0,
        engagement_score: 10, // Initial engagement score for new customer
      });

      this.logger.log(
        `Customer created successfully: ${customer.customer_id} (${customer.phone})`,
      );

      return customer;
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find or create customer by phone
   * Useful for WhatsApp integration - create customer on first message
   */
  async findOrCreate(
    businessId: string,
    tenantId: string,
    phone: string,
    additionalData?: Partial<CreateCustomerDto>,
  ): Promise<Customer> {
    try {
      // Try to find existing customer
      let customer = await this.customerRepository.findByPhone(businessId, phone);

      if (customer) {
        this.logger.log(`Existing customer found: ${customer.customer_id}`);
        return customer;
      }

      // Create new customer
      customer = await this.create({
        business_id: businessId,
        tenant_id: tenantId,
        phone,
        ...additionalData,
      });

      this.logger.log(`New customer created from findOrCreate: ${customer.customer_id}`);
      return customer;
    } catch (error) {
      this.logger.error(`Failed in findOrCreate: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find customer by ID
   */
  async findById(customerId: string): Promise<Customer> {
    try {
      const customer = await this.customerRepository.findById(customerId);

      if (!customer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      return customer;
    } catch (error) {
      this.logger.error(`Failed to find customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all customers with filtering and pagination
   */
  async findAll(
    query: CustomerQueryDto,
  ): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
    try {
      // Validate business exists if business_id filter provided
      if (query.business_id) {
        await this.validateBusinessExists(query.business_id);
      }

      const result = await this.customerRepository.findAll(query);

      this.logger.log(
        `Retrieved ${result.data.length} customers (page ${result.page}/${Math.ceil(result.total / result.limit)})`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to find customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update customer
   */
  async update(customerId: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    try {
      // Check if customer exists
      const existingCustomer = await this.customerRepository.findById(customerId);
      if (!existingCustomer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      // Check phone uniqueness if phone is being updated
      if (updateCustomerDto.phone && updateCustomerDto.phone !== existingCustomer.phone) {
        const duplicateByPhone = await this.customerRepository.findByPhone(
          existingCustomer.business_id,
          updateCustomerDto.phone,
        );

        if (duplicateByPhone && duplicateByPhone.customer_id !== customerId) {
          throw new ConflictException(
            `Another customer with phone ${updateCustomerDto.phone} already exists`,
          );
        }
      }

      // Check email uniqueness if email is being updated
      if (updateCustomerDto.email && updateCustomerDto.email !== existingCustomer.email) {
        const duplicateByEmail = await this.customerRepository.findByEmail(
          existingCustomer.business_id,
          updateCustomerDto.email,
        );

        if (duplicateByEmail && duplicateByEmail.customer_id !== customerId) {
          throw new ConflictException(
            `Another customer with email ${updateCustomerDto.email} already exists`,
          );
        }
      }

      const updated = await this.customerRepository.update(customerId, updateCustomerDto);

      this.logger.log(`Customer updated successfully: ${customerId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete customer
   */
  async delete(customerId: string): Promise<void> {
    try {
      // Check if customer exists
      const existingCustomer = await this.customerRepository.findById(customerId);
      if (!existingCustomer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      // Note: This is hard delete. Consider implementing soft delete in production
      // by adding is_active field to customers table
      await this.customerRepository.delete(customerId);

      this.logger.log(`Customer deleted successfully: ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to delete customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk create customers
   * Handles duplicates gracefully - skips existing, creates new
   */
  async bulkCreate(
    bulkUploadDto: BulkUploadCustomerDto,
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ index: number; phone?: string; error: string }>;
  }> {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; phone?: string; error: string }>,
    };

    this.logger.log(`Starting bulk upload of ${bulkUploadDto.customers.length} customers`);

    for (let i = 0; i < bulkUploadDto.customers.length; i++) {
      const customerDto = bulkUploadDto.customers[i];

      try {
        // Check if customer already exists
        const existing = await this.customerRepository.findByPhone(
          customerDto.business_id,
          customerDto.phone,
        );

        if (existing) {
          results.skipped++;
          this.logger.log(`Skipped existing customer at index ${i}: ${customerDto.phone}`);
          continue;
        }

        // Validate business exists
        await this.validateBusinessExists(customerDto.business_id);

        // Create customer
        await this.customerRepository.create({
          ...customerDto,
          total_orders: 0,
          total_spent: 0,
          engagement_score: 10,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          phone: customerDto.phone,
          error: error.message,
        });

        this.logger.warn(
          `Failed to create customer at index ${i} (${customerDto.phone}): ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Bulk upload completed: ${results.success} succeeded, ${results.skipped} skipped, ${results.failed} failed`,
    );

    return results;
  }

  /**
   * Update engagement score
   * Called when customer performs actions (messages, orders, reviews)
   */
  async updateEngagementScore(customerId: string, delta: number): Promise<void> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      // Calculate new score (0-100 range)
      let newScore = customer.engagement_score + delta;
      newScore = Math.max(0, Math.min(100, newScore)); // Clamp between 0-100

      await this.customerRepository.updateEngagementScore(customerId, newScore);

      this.logger.log(
        `Engagement score updated: ${customer.engagement_score} → ${newScore} (${delta > 0 ? '+' : ''}${delta})`,
      );
    } catch (error) {
      this.logger.error(`Failed to update engagement score: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Increment order stats
   * Called when customer places an order
   */
  async incrementOrderStats(customerId: string, orderAmount: number): Promise<void> {
    try {
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new NotFoundException(`Customer not found: ${customerId}`);
      }

      const newTotalOrders = customer.total_orders + 1;
      const newTotalSpent = customer.total_spent + orderAmount;

      await this.customerRepository.updateOrderStats(
        customerId,
        newTotalOrders,
        newTotalSpent,
        new Date(),
      );

      // Also increase engagement score for placing order
      await this.updateEngagementScore(customerId, 5);

      this.logger.log(
        `Order stats updated for customer ${customerId}: ${newTotalOrders} orders, ₹${newTotalSpent}`,
      );
    } catch (error) {
      this.logger.error(`Failed to increment order stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get top customers (VIP/high-value customers)
   */
  async getTopCustomers(
    businessId: string,
    limit: number = 10,
    sortBy: 'total_spent' | 'total_orders' = 'total_spent',
  ): Promise<Customer[]> {
    try {
      await this.validateBusinessExists(businessId);

      const customers = await this.customerRepository.getTopCustomers(
        businessId,
        limit,
        sortBy,
      );

      this.logger.log(`Retrieved top ${customers.length} customers by ${sortBy}`);

      return customers;
    } catch (error) {
      this.logger.error(`Failed to get top customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get customer segments for targeted campaigns
   */
  async getCustomerSegments(businessId: string): Promise<{
    vip: number; // top 10% by spending
    regular: number; // 10-50% by spending
    new: number; // registered in last 30 days
    dormant: number; // no order in last 90 days
  }> {
    try {
      await this.validateBusinessExists(businessId);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [allCustomers, newCustomers, dormantCustomers] = await Promise.all([
        this.prisma.customers.count({ where: { business_id: businessId } }),
        this.prisma.customers.count({
          where: {
            business_id: businessId,
            created_at: { gte: thirtyDaysAgo },
          },
        }),
        this.prisma.customers.count({
          where: {
            business_id: businessId,
            last_order_date: { lt: ninetyDaysAgo },
          },
        }),
      ]);

      // VIP = top 10%, Regular = 10-50%
      const vipCount = Math.ceil(allCustomers * 0.1);
      const regularCount = Math.ceil(allCustomers * 0.4);

      return {
        vip: vipCount,
        regular: regularCount,
        new: newCustomers,
        dormant: dormantCustomers,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer segments: ${error.message}`, error.stack);
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
}
