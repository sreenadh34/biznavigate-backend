import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrderService } from '../services/order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderStatusDto, ConfirmPaymentDto, UpdateShippingDto } from '../dto/update-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';

/**
 * Order Controller
 * Handles all HTTP requests for order management
 * All endpoints are JWT protected
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Create a new order
   * POST /orders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  /**
   * Get all orders with filters
   * GET /orders?business_id=xxx&status=pending&page=1&limit=20
   */
  @Get()
  async findAll(@Query() query: OrderQueryDto) {
    return this.orderService.findAll(query);
  }

  /**
   * Get order by ID
   * GET /orders/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  /**
   * Update order details
   * PUT /orders/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  /**
   * Update order status
   * PATCH /orders/:id/status
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, updateStatusDto);
  }

  /**
   * Confirm payment for order
   * PATCH /orders/:id/payment
   */
  @Patch(':id/payment')
  async confirmPayment(
    @Param('id') id: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    return this.orderService.confirmPayment(id, confirmPaymentDto);
  }

  /**
   * Update shipping information
   * PATCH /orders/:id/shipping
   */
  @Patch(':id/shipping')
  async updateShipping(
    @Param('id') id: string,
    @Body() updateShippingDto: UpdateShippingDto,
  ) {
    return this.orderService.updateShipping(id, updateShippingDto);
  }

  /**
   * Cancel order
   * DELETE /orders/:id
   */
  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.orderService.cancel(id, reason);
  }

  /**
   * Get order analytics/stats
   * GET /orders/stats/:businessId?startDate=xxx&endDate=xxx
   */
  @Get('stats/:businessId')
  async getStats(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.orderService.getOrderStats(businessId, start, end);
  }
}
