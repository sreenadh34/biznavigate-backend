import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppApiClientService } from '../infrastructure/whatsapp-api-client.service';
import * as crypto from 'crypto';

interface CatalogProduct {
  productId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availability: 'in stock' | 'out of stock';
  url?: string;
}

@Injectable()
export class WhatsAppCatalogService {
  private readonly logger = new Logger(WhatsAppCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappApiClient: WhatsAppApiClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Toggle product in WhatsApp catalog
   */
  async toggleProductInCatalog(
    productId: string,
    businessId: string,
    inCatalog: boolean,
  ): Promise<{ success: boolean; product: any }> {
    // Update product
    const product = await this.prisma.products.update({
      where: { product_id: productId },
      data: {
        in_whatsapp_catalog: inCatalog,
        whatsapp_sync_status: inCatalog ? 'pending' : 'not_synced',
      },
    });

    this.logger.log(
      `Product ${productId} ${inCatalog ? 'added to' : 'removed from'} WhatsApp catalog`,
    );

    return { success: true, product };
  }

  /**
   * Bulk update products in catalog
   */
  async bulkUpdateCatalog(
    productIds: string[],
    businessId: string,
    inCatalog: boolean,
  ): Promise<{ success: boolean; count: number }> {
    const result = await this.prisma.products.updateMany({
      where: {
        product_id: { in: productIds },
        business_id: businessId,
      },
      data: {
        in_whatsapp_catalog: inCatalog,
        whatsapp_sync_status: inCatalog ? 'pending' : 'not_synced',
      },
    });

    this.logger.log(
      `Bulk updated ${result.count} products in WhatsApp catalog`,
    );

    return { success: true, count: result.count };
  }

  /**
   * Get all catalog products for a business
   */
  async getCatalogProducts(businessId: string) {
    return this.prisma.products.findMany({
      where: {
        business_id: businessId,
        in_whatsapp_catalog: true,
        is_active: true,
      },
      include: {
        product_images: {
          where: { is_primary: true },
          take: 1,
        },
        product_categories: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Sync products to WhatsApp Commerce Manager
   */
  async syncToWhatsApp(businessId: string): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    errors: any[];
  }> {
    // Get WhatsApp account
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        business_id: businessId,
        platform: 'whatsapp',
        is_active: true,
      },
    });

    if (!account) {
      throw new BadRequestException(
        'No active WhatsApp account found for this business',
      );
    }

    // Get products to sync
    const products = await this.prisma.products.findMany({
      where: {
        business_id: businessId,
        in_whatsapp_catalog: true,
        is_active: true,
        whatsapp_sync_status: { in: ['pending', 'failed', 'not_synced'] },
      },
      include: {
        product_images: {
          where: { is_primary: true },
          take: 1,
        },
      },
    });

    this.logger.log(
      `Syncing ${products.length} products to WhatsApp for business ${businessId}`,
    );

    let synced = 0;
    let failed = 0;
    const errors: any[] = [];

    const accessToken = this.decryptToken(account.access_token);
    const catalogId = account.instagram_business_account_id; // Using this field to store catalog ID

    for (const product of products) {
      try {
        // Mark as syncing
        await this.prisma.products.update({
          where: { product_id: product.product_id },
          data: { whatsapp_sync_status: 'syncing' },
        });

        // Prepare product data for WhatsApp
        const catalogProduct: CatalogProduct = {
          productId: product.product_id,
          name: product.name,
          description: product.description || '',
          price: Number(product.price) * 100, // Convert to cents
          currency: product.currency || 'INR',
          imageUrl: product.primary_image_url || product.product_images[0]?.file_path,
          availability: product.in_stock ? 'in stock' : 'out of stock',
        };

        // Sync to WhatsApp (using Commerce Manager API)
        const whatsappProduct = await this.syncProductToWhatsApp(
          catalogId,
          accessToken,
          catalogProduct,
          product.whatsapp_catalog_id,
        );

        // Update product with WhatsApp catalog ID
        await this.prisma.products.update({
          where: { product_id: product.product_id },
          data: {
            whatsapp_catalog_id: whatsappProduct.id,
            whatsapp_sync_status: 'synced',
            whatsapp_sync_error: null,
            whatsapp_synced_at: new Date(),
          },
        });

        synced++;
        this.logger.log(`Successfully synced product ${product.product_id}`);
      } catch (error) {
        failed++;
        const errorMessage = error.message || 'Unknown error';
        errors.push({
          productId: product.product_id,
          error: errorMessage,
        });

        // Update product with error
        await this.prisma.products.update({
          where: { product_id: product.product_id },
          data: {
            whatsapp_sync_status: 'failed',
            whatsapp_sync_error: errorMessage,
          },
        });

        this.logger.error(
          `Failed to sync product ${product.product_id}:`,
          error,
        );
      }
    }

    return { success: true, synced, failed, errors };
  }

  /**
   * Sync single product to WhatsApp Commerce Manager
   */
  private async syncProductToWhatsApp(
    catalogId: string,
    accessToken: string,
    product: CatalogProduct,
    existingWhatsAppId?: string,
  ): Promise<{ id: string }> {
    const url = existingWhatsAppId
      ? `https://graph.facebook.com/v18.0/${existingWhatsAppId}`
      : `https://graph.facebook.com/v18.0/${catalogId}/products`;

    const method = existingWhatsAppId ? 'POST' : 'POST';

    const body = {
      retailer_id: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      availability: product.availability,
      image_url: product.imageUrl,
      url: product.url,
    };

    try {
      // Note: This is a simplified version. You'll need to implement the actual API call
      // using the WhatsAppApiClientService or a dedicated method

      this.logger.debug(`Syncing product to WhatsApp: ${JSON.stringify(body)}`);

      // TODO: Implement actual WhatsApp Commerce API call
      // For now, return a mock response
      return {
        id: existingWhatsAppId || `wa_${product.productId}`,
      };

      // Actual implementation would be:
      // const response = await this.whatsappApiClient.syncCatalogProduct(
      //   catalogId,
      //   accessToken,
      //   body,
      //   method,
      // );
      // return response.data;
    } catch (error) {
      this.logger.error('WhatsApp API error:', error);
      throw new BadRequestException(
        `Failed to sync product to WhatsApp: ${error.message}`,
      );
    }
  }

  /**
   * Remove product from WhatsApp catalog
   */
  async removeFromWhatsAppCatalog(
    productId: string,
    businessId: string,
  ): Promise<{ success: boolean }> {
    const product = await this.prisma.products.findUnique({
      where: { product_id: productId },
    });

    if (!product || !product.whatsapp_catalog_id) {
      throw new BadRequestException(
        'Product not found or not synced to WhatsApp',
      );
    }

    // Get WhatsApp account
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        business_id: businessId,
        platform: 'whatsapp',
        is_active: true,
      },
    });

    if (!account) {
      throw new BadRequestException('No active WhatsApp account found');
    }

    try {
      const accessToken = this.decryptToken(account.access_token);

      // TODO: Call WhatsApp API to delete product
      // await this.whatsappApiClient.deleteCatalogProduct(
      //   product.whatsapp_catalog_id,
      //   accessToken,
      // );

      // Update product
      await this.prisma.products.update({
        where: { product_id: productId },
        data: {
          in_whatsapp_catalog: false,
          whatsapp_catalog_id: null,
          whatsapp_sync_status: 'not_synced',
          whatsapp_sync_error: null,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to remove product from WhatsApp:', error);
      throw new BadRequestException(
        `Failed to remove product: ${error.message}`,
      );
    }
  }

  /**
   * Get sync status for business
   */
  async getSyncStatus(businessId: string) {
    const stats = await this.prisma.products.groupBy({
      by: ['whatsapp_sync_status'],
      where: {
        business_id: businessId,
        in_whatsapp_catalog: true,
      },
      _count: true,
    });

    const lastSync = await this.prisma.products.findFirst({
      where: {
        business_id: businessId,
        in_whatsapp_catalog: true,
        whatsapp_synced_at: { not: null },
      },
      orderBy: { whatsapp_synced_at: 'desc' },
      select: { whatsapp_synced_at: true },
    });

    return {
      stats: stats.reduce((acc, stat) => {
        acc[stat.whatsapp_sync_status] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      lastSyncAt: lastSync?.whatsapp_synced_at,
    };
  }

  /**
   * Decrypt access token (copied from WhatsAppOAuth service)
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const encryptionKey = this.configService.get<string>('encryption.key');

      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
      }

      if (!encryptedToken || !encryptedToken.includes(':')) {
        throw new Error('Invalid encrypted token format');
      }

      const key = Buffer.from(encryptionKey, 'hex');
      const parts = encryptedToken.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt token:', error);
      throw new BadRequestException('Token decryption failed');
    }
  }
}
