import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  Header,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatWidgetService } from './chat-widget.service';
import {
  SendWidgetMessageDto,
  InitWidgetDto,
  UpdateVisitorInfoDto,
} from './dto/widget-message.dto';

@ApiTags('Chat Widget')
@Controller('widget')
export class ChatWidgetController {
  private readonly logger = new Logger(ChatWidgetController.name);

  constructor(private readonly chatWidgetService: ChatWidgetService) {}

  /**
   * Serve widget JavaScript file
   */
  @Get('script/:businessId')
  @Header('Content-Type', 'application/javascript')
  @ApiOperation({ summary: 'Get widget script for embedding' })
  async getWidgetScript(
    @Param('businessId') businessId: string,
    @Res() res: Response,
  ) {
    try {
      const config = await this.chatWidgetService.getWidgetConfig(businessId);

      // Generate widget script with embedded config
      const script = this.generateWidgetScript(config);

      res.send(script);
    } catch (error) {
      this.logger.error('Error serving widget script:', error);
      res.status(404).send('// Widget not found');
    }
  }

  /**
   * Get widget configuration
   */
  @Get('config/:businessId')
  @ApiOperation({ summary: 'Get widget configuration' })
  @ApiResponse({ status: 200, description: 'Widget configuration' })
  async getConfig(@Param('businessId') businessId: string) {
    return this.chatWidgetService.getWidgetConfig(businessId);
  }

  /**
   * Initialize widget session (HTTP fallback)
   */
  @Post('init')
  @ApiOperation({ summary: 'Initialize widget session' })
  @ApiResponse({ status: 200, description: 'Widget initialized' })
  async initWidget(@Body() data: InitWidgetDto) {
    return this.chatWidgetService.initWidget(
      data.businessId,
      data.visitorId,
      data.pageUrl,
    );
  }

  /**
   * Send message (HTTP fallback)
   */
  @Post('message')
  @ApiOperation({ summary: 'Send message from widget' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendMessage(@Body() data: SendWidgetMessageDto) {
    return this.chatWidgetService.processMessage(data);
  }

  /**
   * Get conversation history (HTTP fallback)
   */
  @Get('history')
  @ApiOperation({ summary: 'Get conversation history' })
  @ApiResponse({ status: 200, description: 'Conversation history' })
  async getHistory(
    @Query('businessId') businessId: string,
    @Query('visitorId') visitorId: string,
  ) {
    return this.chatWidgetService.getConversationHistory(businessId, visitorId);
  }

  /**
   * Update visitor information
   */
  @Post('visitor/update')
  @ApiOperation({ summary: 'Update visitor information' })
  @ApiResponse({ status: 200, description: 'Visitor information updated' })
  async updateVisitorInfo(@Body() data: UpdateVisitorInfoDto) {
    await this.chatWidgetService.updateVisitorInfo(data);
    return { success: true };
  }

  /**
   * Generate embed code for business
   */
  @Get('embed/:businessId')
  @ApiOperation({ summary: 'Get embed code for website' })
  @ApiResponse({ status: 200, description: 'Embed code' })
  async getEmbedCode(@Param('businessId') businessId: string) {
    const baseUrl = process.env.API_URL || 'http://localhost:3000';

    const embedCode = `<!-- Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['ChatWidget']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'cw', '${baseUrl}/widget/script/${businessId}'));

  cw('init', { businessId: '${businessId}' });
</script>
<!-- End Chat Widget -->`;

    return {
      businessId,
      embedCode,
      instructions: [
        '1. Copy the embed code above',
        '2. Paste it before the closing </body> tag on your website',
        '3. The chat widget will appear automatically',
      ],
    };
  }

  /**
   * Generate widget script dynamically
   */
  private generateWidgetScript(config: any): string {
    // This will be replaced with actual widget.js content
    // For now, return a placeholder that loads the static file
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const wsUrl = process.env.WS_URL || 'ws://localhost:3000';

    return `
(function() {
  'use strict';

  var CONFIG = ${JSON.stringify({
    ...config,
    apiUrl: baseUrl,
    wsUrl: wsUrl,
  })};

  // Load widget CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '${baseUrl}/widget/styles.css';
  document.head.appendChild(link);

  // Load main widget script
  var script = document.createElement('script');
  script.src = '${baseUrl}/widget/widget.js';
  script.onload = function() {
    if (window.ChatWidgetApp) {
      window.ChatWidgetApp.init(CONFIG);
    }
  };
  document.body.appendChild(script);
})();
`;
  }
}
