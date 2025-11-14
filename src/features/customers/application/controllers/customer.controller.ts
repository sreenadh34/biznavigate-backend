import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { BulkUploadCustomerDto } from '../dto/bulk-upload-customer.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/**
 * Customer Controller
 * Handles all HTTP endpoints for customer management
 * Production-grade with JWT authentication and comprehensive error handling
 */
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /customers
   * Create a new customer
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    try {
      this.logger.log(`Creating customer: ${createCustomerDto.phone}`);
      const customer = await this.customerService.create(createCustomerDto);

      return {
        success: true,
        message: 'Customer created successfully',
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /customers/find-or-create
   * Find existing customer by phone or create new one
   * Useful for WhatsApp integration - create customer on first message
   */
  @Post('find-or-create')
  @HttpCode(HttpStatus.OK)
  async findOrCreate(
    @Body()
    body: {
      business_id: string;
      tenant_id: string;
      phone: string;
      name?: string;
      email?: string;
      whatsapp_number?: string;
    },
  ) {
    try {
      this.logger.log(`Find or create customer: ${body.phone}`);
      const customer = await this.customerService.findOrCreate(
        body.business_id,
        body.tenant_id,
        body.phone,
        {
          name: body.name,
          email: body.email,
          whatsapp_number: body.whatsapp_number,
        },
      );

      return {
        success: true,
        message: customer.created_at === customer.updated_at
          ? 'New customer created'
          : 'Existing customer found',
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed in findOrCreate: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /customers/bulk
   * Bulk upload customers (import from CSV/Excel)
   * Skips duplicates gracefully
   */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkCreate(@Body() bulkUploadDto: BulkUploadCustomerDto) {
    try {
      this.logger.log(`Bulk uploading ${bulkUploadDto.customers.length} customers`);
      const results = await this.customerService.bulkCreate(bulkUploadDto);

      return {
        success: true,
        message: `Bulk upload completed: ${results.success} succeeded, ${results.skipped} skipped, ${results.failed} failed`,
        data: results,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk upload customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /customers
   * Get all customers with filtering, pagination, and sorting
   * Supports advanced filters for targeted queries
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: CustomerQueryDto) {
    try {
      this.logger.log(`Fetching customers with filters: ${JSON.stringify(query)}`);
      const result = await this.customerService.findAll(query);

      return {
        success: true,
        message: `Retrieved ${result.data.length} customers`,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /customers/top
   * Get top customers (VIP/high-value customers)
   * Sort by total_spent or total_orders
   */
  @Get('top')
  @HttpCode(HttpStatus.OK)
  async getTopCustomers(
    @Query('business_id') businessId: string,
    @Query('limit') limit?: string,
    @Query('sort_by') sortBy?: 'total_spent' | 'total_orders',
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 10;
      const sortByField = sortBy || 'total_spent';

      this.logger.log(`Fetching top ${limitNum} customers by ${sortByField}`);
      const customers = await this.customerService.getTopCustomers(
        businessId,
        limitNum,
        sortByField,
      );

      return {
        success: true,
        message: `Retrieved top ${customers.length} customers`,
        data: customers,
      };
    } catch (error) {
      this.logger.error(`Failed to get top customers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /customers/segments
   * Get customer segments for targeted campaigns
   * Returns: VIP, regular, new, and dormant customer counts
   */
  @Get('segments')
  @HttpCode(HttpStatus.OK)
  async getCustomerSegments(@Query('business_id') businessId: string) {
    try {
      this.logger.log(`Fetching customer segments for business: ${businessId}`);
      const segments = await this.customerService.getCustomerSegments(businessId);

      return {
        success: true,
        message: 'Customer segments retrieved successfully',
        data: segments,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer segments: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /customers/:id
   * Get customer by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching customer: ${id}`);
      const customer = await this.customerService.findById(id);

      return {
        success: true,
        message: 'Customer retrieved successfully',
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * PUT /customers/:id
   * Update customer
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    try {
      this.logger.log(`Updating customer: ${id}`);
      const customer = await this.customerService.update(id, updateCustomerDto);

      return {
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed to update customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * PATCH /customers/:id/engagement
   * Update customer engagement score
   * Used when customer interacts (messages, orders, reviews)
   */
  @Patch(':id/engagement')
  @HttpCode(HttpStatus.OK)
  async updateEngagementScore(
    @Param('id') id: string,
    @Body() body: { delta: number },
  ) {
    try {
      this.logger.log(`Updating engagement score for customer ${id}: delta ${body.delta}`);
      await this.customerService.updateEngagementScore(id, body.delta);

      return {
        success: true,
        message: 'Engagement score updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update engagement score: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * DELETE /customers/:id
   * Delete customer
   * Note: This is hard delete. Consider implementing soft delete in production
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    try {
      this.logger.log(`Deleting customer: ${id}`);
      await this.customerService.delete(id);

      return {
        success: true,
        message: 'Customer deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete customer: ${error.message}`, error.stack);
      throw error;
    }
  }
}
