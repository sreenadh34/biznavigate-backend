import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { WhatsAppCatalogService } from './services/whatsapp-catalog.service';
import {
  ToggleProductInCatalogDto,
  BulkToggleCatalogDto,
  SyncCatalogDto,
} from './dto/whatsapp-catalog.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('whatsapp/catalog')
@UseGuards(JwtAuthGuard)
export class WhatsAppCatalogController {
  constructor(
    private readonly catalogService: WhatsAppCatalogService,
  ) {}

  /**
   * Get all products in catalog
   */
  @Get(':businessId')
  async getCatalogProducts(@Param('businessId') businessId: string) {
    return this.catalogService.getCatalogProducts(businessId);
  }

  /**
   * Toggle single product in catalog
   */
  @Post(':businessId/toggle')
  async toggleProduct(
    @Param('businessId') businessId: string,
    @Body() dto: ToggleProductInCatalogDto,
  ) {
    return this.catalogService.toggleProductInCatalog(
      dto.productId,
      businessId,
      dto.inCatalog,
    );
  }

  /**
   * Bulk toggle products in catalog
   */
  @Post(':businessId/bulk-toggle')
  async bulkToggle(
    @Param('businessId') businessId: string,
    @Body() dto: BulkToggleCatalogDto,
  ) {
    return this.catalogService.bulkUpdateCatalog(
      dto.productIds,
      businessId,
      dto.inCatalog,
    );
  }

  /**
   * Sync catalog products to WhatsApp
   */
  @Post(':businessId/sync')
  async syncCatalog(
    @Param('businessId') businessId: string,
    @Body() dto: SyncCatalogDto,
  ) {
    return this.catalogService.syncToWhatsApp(businessId);
  }

  /**
   * Remove product from WhatsApp catalog
   */
  @Delete(':businessId/product/:productId')
  async removeProduct(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
  ) {
    return this.catalogService.removeFromWhatsAppCatalog(productId, businessId);
  }

  /**
   * Get sync status
   */
  @Get(':businessId/sync-status')
  async getSyncStatus(@Param('businessId') businessId: string) {
    return this.catalogService.getSyncStatus(businessId);
  }
}
