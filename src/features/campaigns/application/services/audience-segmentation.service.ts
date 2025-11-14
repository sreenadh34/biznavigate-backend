import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AudienceSegmentDto, AudienceType } from '../dto/campaign.dto';

/**
 * Audience Segmentation Service
 * Handles audience selection from leads and customers for campaigns
 */
@Injectable()
export class AudienceSegmentationService {
  private readonly logger = new Logger(AudienceSegmentationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get audience based on segmentation criteria
   */
  async getAudience(dto: AudienceSegmentDto) {
    this.logger.log(
      `Getting ${dto.audienceType} audience for business ${dto.businessId}`,
    );

    switch (dto.audienceType) {
      case AudienceType.ALL:
        return this.getAllAudience(dto.businessId, dto.tenantId);

      case AudienceType.LEADS:
        return this.getLeadsAudience(dto.businessId, dto.tenantId, dto.filter);

      case AudienceType.CUSTOMERS:
        return this.getCustomersAudience(
          dto.businessId,
          dto.tenantId,
          dto.filter,
        );

      case AudienceType.SEGMENT:
      case AudienceType.CUSTOM:
        return this.getCustomSegment(dto.businessId, dto.tenantId, dto.filter);

      default:
        throw new Error(`Unsupported audience type: ${dto.audienceType}`);
    }
  }

  /**
   * Get all audience (leads + customers)
   */
  private async getAllAudience(businessId: string, tenantId: string) {
    // Get all leads with phone numbers
    const leads = await this.prisma.leads.findMany({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
        phone: { not: null },
        is_active: true,
      },
      select: {
        lead_id: true,
        first_name: true,
        last_name: true,
        phone: true,
        email: true,
      },
    });

    // Get all customers with phone numbers
    const customers = await this.prisma.customers.findMany({
      where: {
        business_id: businessId,
        tenant_id: tenantId,
        phone: { not: null },
      },
      select: {
        customer_id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    // Combine and deduplicate by phone number
    const phoneMap = new Map();

    leads.forEach((lead) => {
      if (lead.phone && !phoneMap.has(lead.phone)) {
        phoneMap.set(lead.phone, {
          id: lead.lead_id,
          name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          phone: lead.phone,
          email: lead.email,
          type: 'lead',
        });
      }
    });

    customers.forEach((customer) => {
      if (customer.phone && !phoneMap.has(customer.phone)) {
        phoneMap.set(customer.phone, {
          id: customer.customer_id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          type: 'customer',
        });
      }
    });

    return Array.from(phoneMap.values());
  }

  /**
   * Get leads audience with optional filters
   */
  private async getLeadsAudience(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    const where: any = {
      business_id: businessId,
      tenant_id: tenantId,
      phone: { not: null },
      is_active: true,
    };

    // Apply filters
    if (filter) {
      if (filter.leadStatus && filter.leadStatus.length > 0) {
        where.status = { in: filter.leadStatus };
      }

      if (filter.leadQuality && filter.leadQuality.length > 0) {
        where.lead_quality = { in: filter.leadQuality };
      }

      if (filter.tags && filter.tags.length > 0) {
        where.lead_tag_assignments = {
          some: {
            tags: {
              tag_name: { in: filter.tags },
            },
          },
        };
      }

      if (filter.city && filter.city.length > 0) {
        where.city = { in: filter.city };
      }

      if (filter.state && filter.state.length > 0) {
        where.state = { in: filter.state };
      }
    }

    const leads = await this.prisma.leads.findMany({
      where,
      select: {
        lead_id: true,
        first_name: true,
        last_name: true,
        phone: true,
        email: true,
        status: true,
        lead_quality: true,
      },
    });

    return leads.map((lead) => ({
      id: lead.lead_id,
      name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      phone: lead.phone,
      email: lead.email,
      type: 'lead',
      metadata: {
        status: lead.status,
        quality: lead.lead_quality,
      },
    }));
  }

  /**
   * Get customers audience with optional filters
   */
  private async getCustomersAudience(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    const where: any = {
      business_id: businessId,
      tenant_id: tenantId,
      phone: { not: null },
    };

    // Apply engagement score filter
    if (filter?.minEngagementScore !== undefined) {
      where.engagement_score = {
        ...where.engagement_score,
        gte: filter.minEngagementScore,
      };
    }

    if (filter?.maxEngagementScore !== undefined) {
      where.engagement_score = {
        ...where.engagement_score,
        lte: filter.maxEngagementScore,
      };
    }

    // Apply spending filter
    if (filter?.minTotalSpent !== undefined) {
      where.total_spent = {
        ...where.total_spent,
        gte: filter.minTotalSpent,
      };
    }

    if (filter?.maxTotalSpent !== undefined) {
      where.total_spent = {
        ...where.total_spent,
        lte: filter.maxTotalSpent,
      };
    }

    // Apply orders count filter
    if (filter?.minOrders !== undefined) {
      where.total_orders = {
        ...where.total_orders,
        gte: filter.minOrders,
      };
    }

    if (filter?.maxOrders !== undefined) {
      where.total_orders = {
        ...where.total_orders,
        lte: filter.maxOrders,
      };
    }

    // Apply last order date filter
    if (filter?.lastOrderDaysAgo !== undefined) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - filter.lastOrderDaysAgo);
      where.last_order_date = {
        gte: daysAgo,
      };
    }

    const customers = await this.prisma.customers.findMany({
      where,
      select: {
        customer_id: true,
        name: true,
        phone: true,
        email: true,
        engagement_score: true,
        total_spent: true,
        total_orders: true,
        last_order_date: true,
      },
    });

    return customers.map((customer) => ({
      id: customer.customer_id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: 'customer',
      metadata: {
        engagement_score: customer.engagement_score,
        total_spent: Number(customer.total_spent),
        total_orders: customer.total_orders,
        last_order_date: customer.last_order_date,
      },
    }));
  }

  /**
   * Get custom segment with advanced filters
   */
  private async getCustomSegment(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    // Combine both leads and customers with filters
    const [leads, customers] = await Promise.all([
      this.getLeadsAudience(businessId, tenantId, filter),
      this.getCustomersAudience(businessId, tenantId, filter),
    ]);

    // Deduplicate by phone number
    const phoneMap = new Map();
    [...leads, ...customers].forEach((contact) => {
      if (contact.phone && !phoneMap.has(contact.phone)) {
        phoneMap.set(contact.phone, contact);
      }
    });

    return Array.from(phoneMap.values());
  }

  /**
   * Preview audience count without fetching all data
   */
  async previewAudienceCount(dto: AudienceSegmentDto): Promise<number> {
    this.logger.log(
      `Previewing ${dto.audienceType} audience count for business ${dto.businessId}`,
    );

    switch (dto.audienceType) {
      case AudienceType.ALL:
        return this.countAllAudience(dto.businessId, dto.tenantId);

      case AudienceType.LEADS:
        return this.countLeadsAudience(
          dto.businessId,
          dto.tenantId,
          dto.filter,
        );

      case AudienceType.CUSTOMERS:
        return this.countCustomersAudience(
          dto.businessId,
          dto.tenantId,
          dto.filter,
        );

      case AudienceType.SEGMENT:
      case AudienceType.CUSTOM:
        return this.countCustomSegment(
          dto.businessId,
          dto.tenantId,
          dto.filter,
        );

      default:
        return 0;
    }
  }

  private async countAllAudience(businessId: string, tenantId: string) {
    const [leadsCount, customersCount] = await Promise.all([
      this.prisma.leads.count({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          phone: { not: null },
          is_active: true,
        },
      }),
      this.prisma.customers.count({
        where: {
          business_id: businessId,
          tenant_id: tenantId,
          phone: { not: null },
        },
      }),
    ]);

    // Note: This is approximate as it doesn't account for duplicates
    return leadsCount + customersCount;
  }

  private async countLeadsAudience(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    const where: any = {
      business_id: businessId,
      tenant_id: tenantId,
      phone: { not: null },
      is_active: true,
    };

    if (filter) {
      if (filter.leadStatus && filter.leadStatus.length > 0) {
        where.status = { in: filter.leadStatus };
      }
      if (filter.leadQuality && filter.leadQuality.length > 0) {
        where.lead_quality = { in: filter.leadQuality };
      }
      if (filter.city && filter.city.length > 0) {
        where.city = { in: filter.city };
      }
      if (filter.state && filter.state.length > 0) {
        where.state = { in: filter.state };
      }
    }

    return this.prisma.leads.count({ where });
  }

  private async countCustomersAudience(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    const where: any = {
      business_id: businessId,
      tenant_id: tenantId,
      phone: { not: null },
    };

    if (filter) {
      if (filter.minEngagementScore !== undefined) {
        where.engagement_score = {
          ...where.engagement_score,
          gte: filter.minEngagementScore,
        };
      }
      if (filter.maxEngagementScore !== undefined) {
        where.engagement_score = {
          ...where.engagement_score,
          lte: filter.maxEngagementScore,
        };
      }
      if (filter.minTotalSpent !== undefined) {
        where.total_spent = { ...where.total_spent, gte: filter.minTotalSpent };
      }
      if (filter.maxTotalSpent !== undefined) {
        where.total_spent = { ...where.total_spent, lte: filter.maxTotalSpent };
      }
      if (filter.minOrders !== undefined) {
        where.total_orders = { ...where.total_orders, gte: filter.minOrders };
      }
      if (filter.maxOrders !== undefined) {
        where.total_orders = { ...where.total_orders, lte: filter.maxOrders };
      }
    }

    return this.prisma.customers.count({ where });
  }

  private async countCustomSegment(
    businessId: string,
    tenantId: string,
    filter?: any,
  ) {
    const [leadsCount, customersCount] = await Promise.all([
      this.countLeadsAudience(businessId, tenantId, filter),
      this.countCustomersAudience(businessId, tenantId, filter),
    ]);

    return leadsCount + customersCount;
  }

  /**
   * Get sample audience for preview (first 10 records)
   */
  async getSampleAudience(dto: AudienceSegmentDto, limit: number = 10) {
    const audience = await this.getAudience(dto);
    return audience.slice(0, limit);
  }
}
