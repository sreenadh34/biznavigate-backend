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
  ValidationPipe,
} from '@nestjs/common';
import { ReviewsService } from '../services/reviews.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { RespondReviewDto } from '../dto/respond-review.dto';
import { QueryReviewsDto } from '../dto/query-reviews.dto';
import { JwtAuthGuard } from 'src/common/guards';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /reviews
   * Create a new review
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) dto: CreateReviewDto) {
    const review = await this.reviewsService.create(dto);
    return {
      success: true,
      message: 'Review created successfully',
      data: review,
    };
  }

  /**
   * GET /reviews
   * Get all reviews with filters
   */
  @Get()
  async findAll(@Query(ValidationPipe) query: QueryReviewsDto) {
    const result = await this.reviewsService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * GET /reviews/analytics
   * Get reviews analytics for a business
   */
  @Get('analytics')
  async getAnalytics(
    @Query('business_id') businessId: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    const analytics = await this.reviewsService.getAnalytics(businessId, fromDate, toDate);
    return {
      success: true,
      data: analytics,
    };
  }

  /**
   * GET /reviews/product/:productId/analytics
   * Get analytics for a specific product
   */
  @Get('product/:productId/analytics')
  async getProductAnalytics(@Param('productId') productId: string) {
    const analytics = await this.reviewsService.getProductAnalytics(productId);
    return {
      success: true,
      data: analytics,
    };
  }

  /**
   * GET /reviews/:id
   * Get a single review by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const review = await this.reviewsService.findOne(id);
    return {
      success: true,
      data: review,
    };
  }

  /**
   * PUT /reviews/:id
   * Update a review
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateReviewDto,
  ) {
    const review = await this.reviewsService.update(id, dto);
    return {
      success: true,
      message: 'Review updated successfully',
      data: review,
    };
  }

  /**
   * POST /reviews/:id/respond
   * Add business response to a review
   */
  @Post(':id/respond')
  async respond(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: RespondReviewDto,
  ) {
    const review = await this.reviewsService.respond(id, dto);
    return {
      success: true,
      message: 'Response added successfully',
      data: review,
    };
  }

  /**
   * POST /reviews/:id/helpful
   * Mark review as helpful
   */
  @Post(':id/helpful')
  async markHelpful(@Param('id') id: string) {
    const review = await this.reviewsService.markHelpful(id);
    return {
      success: true,
      message: 'Review marked as helpful',
      data: review,
    };
  }

  /**
   * POST /reviews/:id/report
   * Report a review
   */
  @Post(':id/report')
  async report(@Param('id') id: string) {
    const review = await this.reviewsService.report(id);
    return {
      success: true,
      message: 'Review reported',
      data: review,
    };
  }

  /**
   * DELETE /reviews/:id
   * Delete a review
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    const result = await this.reviewsService.delete(id);
    return {
      success: true,
      ...result,
    };
  }
}
