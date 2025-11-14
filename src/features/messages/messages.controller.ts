import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import type {
  CreateMessageDto,
  CreateConversationDto,
  GetConversationsDto,
  UpdateConversationDto,
  GetAiSuggestionsDto,
} from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getConversations(@Req() req: any, @Query() query: GetConversationsDto) {
    const businessId = req.user.business_id;
    const tenantId = req.user.tenant_id;
    return this.messagesService.getConversations(businessId, tenantId, query);
  }

  @Get('conversations/:id')
  getConversation(@Req() req: any, @Param('id') id: string) {
    const businessId = req.user.business_id;
    return this.messagesService.getConversation(id, businessId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Req() req: any, @Param('id') id: string) {
    const businessId = req.user.business_id;
    return this.messagesService.getMessages(id, businessId);
  }

  @Post('conversations')
  createConversation(@Req() req: any, @Body() createConversationDto: CreateConversationDto) {
    const businessId = req.user.business_id;
    const tenantId = req.user.tenant_id;
    return this.messagesService.createConversation(businessId, tenantId, createConversationDto);
  }

  @Post('send')
  sendMessage(@Req() req: any, @Body() createMessageDto: CreateMessageDto) {
    const businessId = req.user.business_id;
    const userId = req.user.user_id;
    return this.messagesService.sendMessage(businessId, userId, createMessageDto);
  }

  @Post('ai-suggestions')
  getAiSuggestions(@Req() req: any, @Body() getAiSuggestionsDto: GetAiSuggestionsDto) {
    const businessId = req.user.business_id;
    return this.messagesService.getAiSuggestions(businessId, getAiSuggestionsDto);
  }

  @Patch('conversations/:id')
  updateConversation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    const businessId = req.user.business_id;
    return this.messagesService.updateConversation(id, businessId, updateConversationDto);
  }

  @Delete('conversations/:id')
  deleteConversation(@Req() req: any, @Param('id') id: string) {
    const businessId = req.user.business_id;
    return this.messagesService.deleteConversation(id, businessId);
  }
}
