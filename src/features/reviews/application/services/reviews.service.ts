import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { RespondReviewDto } from '../dto/respond-review.dto';
import { QueryReviewsDto } from '../dto/query-reviews.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new product review
   */
  async create(dto: CreateReviewDto) {
    try {
      // Verify product exists
      const product = await this.prisma.products.findUnique({
        where: { product_id: dto.product_id },
      });

      if (!product) {
        throw new NotFoundException(`Product ${dto.product_id} not found`);
      }

      // Check if order exists and customer purchased this product
      let isVerified = false;
      if (dto.order_id) {
        const order = await this.prisma.orders.findFirst({
          where: {
            order_id: dto.order_id,
            customer_id: dto.customer_id,
            status: 'completed',
          },
          include: {
            order_items: {
              where: { product_id: dto.product_id },
            },
          },
        });

        if (order && order.order_items.length > 0) {
          isVerified = true;
        }
      }

      const review = await this.prisma.product_reviews.create({
        data: {
          business_id: dto.business_id,
          tenant_id: dto.tenant_id,
          product_id: dto.product_id,
          customer_id: dto.customer_id,
          order_id: dto.order_id,
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          photo_urls: dto.photo_urls || [],
          video_url: dto.video_url,
          is_verified: isVerified,
        },
        include: {
          customer: true,
          product: {
            select: {
              product_id: true,
              name: true,
              primary_image_url: true,
            },
          },
        },
      });

      this.logger.log(`Review created: ${review.review_id} for product ${dto.product_id}`);
      return review;
    } catch (error) {
      this.logger.error(`Failed to create review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get reviews with filters and pagination
   */
  async findAll(query: QueryReviewsDto) {
    try {
      const {
        business_id,
        product_id,
        customer_id,
        order_id,
        rating,
        is_verified,
        is_featured,
        is_published,
        from_date,
        to_date,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        order = 'desc',
      } = query;

      // Build where clause
      const where: any = {};

      if (business_id) where.business_id = business_id;
      if (product_id) where.product_id = product_id;
      if (customer_id) where.customer_id = customer_id;
      if (order_id) where.order_id = order_id;
      if (rating !== undefined) where.rating = rating;
      if (is_verified !== undefined) where.is_verified = is_verified;
      if (is_featured !== undefined) where.is_featured = is_featured;
      if (is_published !== undefined) where.is_published = is_published;

      // Date range filter
      if (from_date || to_date) {
        where.created_at = {};
        if (from_date) where.created_at.gte = new Date(from_date);
        if (to_date) where.created_at.lte = new Date(to_date);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await this.prisma.product_reviews.count({ where });

      // Get reviews
      const reviews = await this.prisma.product_reviews.findMany({
        where,
        include: {
          customer: {
            select: {
              customer_id: true,
              name: true,
              email: true,
            },
          },
          product: {
            select: {
              product_id: true,
              name: true,
              primary_image_url: true,
            },
          },
          responder: {
            select: {
              user_id: true,
              name: true,
            },
          },
        },
        orderBy: {
          [sort_by]: order,
        },
        skip,
        take: limit,
      });

      return {
        data: reviews,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch reviews: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a single review by ID
   */
  async findOne(reviewId: string) {
    try {
      const review = await this.prisma.product_reviews.findUnique({
        where: { review_id: reviewId },
        include: {
          customer: {
            select: {
              customer_id: true,
              name: true,
              email: true,
            },
          },
          product: {
            select: {
              product_id: true,
              name: true,
              primary_image_url: true,
              price: true,
            },
          },
          order: {
            select: {
              order_id: true,
              order_number: true,
              created_at: true,
            },
          },
          responder: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!review) {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }

      return review;
    } catch (error) {
      this.logger.error(`Failed to fetch review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a review
   */
  async update(reviewId: string, dto: UpdateReviewDto) {
    try {
      const review = await this.prisma.product_reviews.update({
        where: { review_id: reviewId },
        data: {
          ...dto,
          updated_at: new Date(),
        },
        include: {
          customer: true,
          product: true,
        },
      });

      this.logger.log(`Review updated: ${reviewId}`);
      return review;
    } catch (error) {
      this.logger.error(`Failed to update review: ${error.message}`, error.stack);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }
      throw error;
    }
  }

  /**
   * Respond to a review (business owner response)
   */
  async respond(reviewId: string, dto: RespondReviewDto) {
    try {
      const review = await this.prisma.product_reviews.update({
        where: { review_id: reviewId },
        data: {
          response_text: dto.response_text,
          response_date: new Date(),
          responded_by: dto.responded_by,
          updated_at: new Date(),
        },
        include: {
          customer: true,
          product: true,
          responder: true,
        },
      });

      this.logger.log(`Response added to review: ${reviewId}`);
      return review;
    } catch (error) {
      this.logger.error(`Failed to respond to review: ${error.message}`, error.stack);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }
      throw error;
    }
  }

  /**
   * Mark review as helpful
   */
  async markHelpful(reviewId: string) {
    try {
      const review = await this.prisma.product_reviews.update({
        where: { review_id: reviewId },
        data: {
          helpful_count: {
            increment: 1,
          },
        },
      });

      this.logger.log(`Review ${reviewId} marked as helpful`);
      return review;
    } catch (error) {
      this.logger.error(`Failed to mark review as helpful: ${error.message}`, error.stack);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }
      throw error;
    }
  }

  /**
   * Report a review
   */
  async report(reviewId: string) {
    try {
      const review = await this.prisma.product_reviews.update({
        where: { review_id: reviewId },
        data: {
          reported_count: {
            increment: 1,
          },
        },
      });

      // Auto-unpublish if too many reports
      if (review.reported_count >= 5) {
        await this.prisma.product_reviews.update({
          where: { review_id: reviewId },
          data: { is_published: false },
        });

        this.logger.warn(`Review ${reviewId} auto-unpublished due to reports`);
      }

      this.logger.log(`Review ${reviewId} reported`);
      return review;
    } catch (error) {
      this.logger.error(`Failed to report review: ${error.message}`, error.stack);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async delete(reviewId: string) {
    try {
      await this.prisma.product_reviews.delete({
        where: { review_id: reviewId },
      });

      this.logger.log(`Review deleted: ${reviewId}`);
      return { message: 'Review deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete review: ${error.message}`, error.stack);
      if (error.code === 'P2025') {
        throw new NotFoundException(`Review ${reviewId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get reviews analytics for a business
   */
  async getAnalytics(businessId: string, fromDate?: string, toDate?: string) {
    try {
      const where: any = { business_id: businessId, is_published: true };

      if (fromDate || toDate) {
        where.created_at = {};
        if (fromDate) where.created_at.gte = new Date(fromDate);
        if (toDate) where.created_at.lte = new Date(toDate);
      }

      // Get all reviews
      const reviews = await this.prisma.product_reviews.findMany({
        where,
        select: {
          rating: true,
          is_verified: true,
          photo_urls: true,
          response_text: true,
        },
      });

      const totalReviews = reviews.length;

      if (totalReviews === 0) {
        return {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
          verifiedReviews: 0,
          reviewsWithPhotos: 0,
          reviewsWithResponses: 0,
          responseRate: 0,
        };
      }

      // Calculate metrics
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / totalReviews;

      // Rating distribution
      const ratingDistribution = {
        '5': reviews.filter(r => r.rating === 5).length,
        '4': reviews.filter(r => r.rating === 4).length,
        '3': reviews.filter(r => r.rating === 3).length,
        '2': reviews.filter(r => r.rating === 2).length,
        '1': reviews.filter(r => r.rating === 1).length,
      };

      const verifiedReviews = reviews.filter(r => r.is_verified).length;
      const reviewsWithPhotos = reviews.filter(r => r.photo_urls && (r.photo_urls as any[]).length > 0).length;
      const reviewsWithResponses = reviews.filter(r => r.response_text).length;
      const responseRate = totalReviews > 0 ? (reviewsWithResponses / totalReviews) * 100 : 0;

      return {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        verifiedReviews,
        reviewsWithPhotos,
        reviewsWithResponses,
        responseRate: Math.round(responseRate),
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get reviews analytics for a specific product
   */
  async getProductAnalytics(productId: string) {
    try {
      const reviews = await this.prisma.product_reviews.findMany({
        where: {
          product_id: productId,
          is_published: true,
        },
        select: {
          rating: true,
          is_verified: true,
          helpful_count: true,
        },
      });

      const totalReviews = reviews.length;

      if (totalReviews === 0) {
        return {
          productId,
          totalReviews: 0,
          averageRating: 0,
          verifiedReviews: 0,
          ratingDistribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
        };
      }

      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / totalReviews;

      const ratingDistribution = {
        '5': reviews.filter(r => r.rating === 5).length,
        '4': reviews.filter(r => r.rating === 4).length,
        '3': reviews.filter(r => r.rating === 3).length,
        '2': reviews.filter(r => r.rating === 2).length,
        '1': reviews.filter(r => r.rating === 1).length,
      };

      const verifiedReviews = reviews.filter(r => r.is_verified).length;

      return {
        productId,
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        verifiedReviews,
        ratingDistribution,
      };
    } catch (error) {
      this.logger.error(`Failed to get product analytics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
