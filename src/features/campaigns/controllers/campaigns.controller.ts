import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CampaignService } from '../application/services/campaign.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignQueryDto,
  SendCampaignDto,
  AudienceType,
} from '../application/dto/campaign.dto';

/**
 * Campaigns Controller
 * Manages marketing campaigns with audience targeting and WhatsApp delivery
 */
@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  private readonly logger = new Logger(CampaignsController.name);

  constructor(private readonly campaignService: CampaignService) {}

  /**
   * Create a new campaign
   */
  @Post()
  @ApiOperation({
    summary: 'Create new campaign',
    description: 'Create a new marketing campaign with audience targeting',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Campaign created successfully',
  })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    this.logger.log(`Creating campaign: ${dto.campaignName}`);
    return this.campaignService.createCampaign(dto);
  }

  /**
   * Get all campaigns
   */
  @Get()
  @ApiOperation({
    summary: 'Get all campaigns',
    description: 'Retrieve campaigns with pagination and filtering',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaigns retrieved successfully',
  })
  async getCampaigns(@Query() query: CampaignQueryDto) {
    return this.campaignService.getCampaigns(query);
  }

  /**
   * Get campaign by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get campaign by ID',
    description: 'Retrieve detailed campaign information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign retrieved successfully',
  })
  async getCampaign(@Param('id') id: string) {
    return this.campaignService.getCampaign(id);
  }

  /**
   * Update campaign
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update campaign',
    description: 'Update campaign details (only for draft/scheduled campaigns)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign updated successfully',
  })
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    this.logger.log(`Updating campaign: ${id}`);
    return this.campaignService.updateCampaign(id, dto);
  }

  /**
   * Delete campaign
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete campaign',
    description: 'Cancel/delete a campaign (soft delete)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign deleted successfully',
  })
  async deleteCampaign(@Param('id') id: string) {
    this.logger.log(`Deleting campaign: ${id}`);
    return this.campaignService.deleteCampaign(id);
  }

  /**
   * Send campaign immediately
   */
  @Post('send')
  @ApiOperation({
    summary: 'Send campaign',
    description: 'Send campaign immediately to all recipients',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign queued for sending',
  })
  async sendCampaign(@Body() dto: SendCampaignDto) {
    this.logger.log(`Sending campaign: ${dto.campaignId}`);
    return this.campaignService.sendCampaign(dto);
  }

  /**
   * Get campaign statistics
   */
  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get campaign statistics',
    description: 'Retrieve detailed campaign performance metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign stats retrieved successfully',
  })
  async getCampaignStats(@Param('id') id: string) {
    return this.campaignService.getCampaignStats(id);
  }

  /**
   * Preview campaign audience
   */
  @Post('audience/preview')
  @ApiOperation({
    summary: 'Preview campaign audience',
    description: 'Preview audience size and sample recipients before creating campaign',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audience preview retrieved successfully',
  })
  async previewAudience(
    @Body()
    body: {
      businessId: string;
      tenantId: string;
      audienceType: string;
      audienceFilter?: any;
    },
  ) {
    return this.campaignService.previewAudience(
      body.businessId,
      body.tenantId,
      body.audienceType,
      body.audienceFilter,
    );
  }
}
