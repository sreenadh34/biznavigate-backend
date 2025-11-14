import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateMessageDto {
  conversation_id: string;
  content: string;
  attachments?: any[];
  use_ai?: boolean;
}

export interface CreateConversationDto {
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  platform: string;
  platform_contact_id?: string;
  initial_message?: string;
}

export interface GetConversationsDto {
  search?: string;
  platform?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export interface UpdateConversationDto {
  status?: string;
  priority?: string;
  is_starred?: boolean;
  tags?: string[];
  assigned_to?: string;
}

export interface GetAiSuggestionsDto {
  conversation_id: string;
  context?: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConversations(businessId: string, tenantId: string, query: GetConversationsDto) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      business_id: businessId,
      tenant_id: tenantId,
    };

    if (query.search) {
      where.OR = [
        { contact_name: { contains: query.search, mode: 'insensitive' } },
        { last_message: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.platform) {
      where.platform = query.platform;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.conversations.findMany({
        where,
        orderBy: { last_message_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversations.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getConversation(id: string, businessId: string) {
    const conversation = await this.prisma.conversations.findFirst({
      where: { conversation_id: id, business_id: businessId },
      include: { messages: { orderBy: { created_at: 'asc' } } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Mark as read
    if (conversation.status === 'unread') {
      await this.prisma.conversations.update({
        where: { conversation_id: id },
        data: { status: 'read', unread_count: 0 },
      });
    }

    return conversation;
  }

  async getMessages(conversationId: string, businessId: string) {
    const conversation = await this.prisma.conversations.findFirst({
      where: { conversation_id: conversationId, business_id: businessId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });
  }

  async createConversation(businessId: string, tenantId: string, dto: CreateConversationDto) {
    const conversation = await this.prisma.conversations.create({
      data: {
        business_id: businessId,
        tenant_id: tenantId,
        contact_name: dto.contact_name,
        contact_phone: dto.contact_phone,
        contact_email: dto.contact_email,
        platform: dto.platform,
        platform_contact_id: dto.platform_contact_id,
        last_message: dto.initial_message || null,
        last_message_at: new Date(),
        status: 'unread',
        unread_count: dto.initial_message ? 1 : 0,
        tags: [],
      },
    });

    if (dto.initial_message) {
      await this.prisma.messages.create({
        data: {
          conversation_id: conversation.conversation_id,
          content: dto.initial_message,
          direction: 'incoming',
          status: 'delivered',
        },
      });
    }

    return conversation;
  }

  async sendMessage(businessId: string, userId: string, dto: CreateMessageDto) {
    const conversation = await this.prisma.conversations.findFirst({
      where: {
        conversation_id: dto.conversation_id,
        business_id: businessId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const message = await this.prisma.messages.create({
      data: {
        conversation_id: dto.conversation_id,
        content: dto.content,
        direction: 'outgoing',
        status: 'sent',
        sent_by: userId,
        is_ai_generated: dto.use_ai || false,
        attachments: dto.attachments || null,
      },
    });

    await this.prisma.conversations.update({
      where: { conversation_id: dto.conversation_id },
      data: {
        last_message: dto.content,
        last_message_at: new Date(),
        status: 'replied',
      },
    });

    // TODO: Send message via WhatsApp/Instagram API

    return message;
  }

  async updateConversation(id: string, businessId: string, dto: UpdateConversationDto) {
    const conversation = await this.prisma.conversations.findFirst({
      where: { conversation_id: id, business_id: businessId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversations.update({
      where: { conversation_id: id },
      data: dto,
    });
  }

  async deleteConversation(id: string, businessId: string) {
    const conversation = await this.prisma.conversations.findFirst({
      where: { conversation_id: id, business_id: businessId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversations.delete({
      where: { conversation_id: id },
    });
  }

  async getAiSuggestions(businessId: string, dto: GetAiSuggestionsDto) {
    const conversation = await this.prisma.conversations.findFirst({
      where: {
        conversation_id: dto.conversation_id,
        business_id: businessId,
      },
      include: { messages: { orderBy: { created_at: 'desc' }, take: 5 } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const lastMessage = conversation.messages[0]?.content.toLowerCase() || '';

    // Smart suggestions based on keywords
    if (lastMessage.includes('price') || lastMessage.includes('cost') || lastMessage.includes('₹')) {
      return [
        'Our products range from ₹999 to ₹2,499. I can share detailed pricing and offers with you!',
        'We have special discounts running this week. Would you like to know more about pricing?',
        'Let me send you our complete catalog with pricing. We also offer combo deals!',
      ];
    } else if (lastMessage.includes('delivery') || lastMessage.includes('shipping')) {
      return [
        'We offer free delivery on orders above ₹500. Standard delivery takes 3-5 business days.',
        'We deliver pan-India! Where should we ship your order?',
        'We have express delivery available. When would you like to receive it?',
      ];
    } else if (lastMessage.includes('available') || lastMessage.includes('stock')) {
      return [
        'Yes, this item is in stock! Would you like to place an order?',
        'We have limited stock available. I can reserve it for you if you would like!',
        'Currently available in multiple variants. Which one interests you?',
      ];
    } else if (lastMessage.includes('color') || lastMessage.includes('colour') || lastMessage.includes('blue')) {
      return [
        'We have 5 beautiful shades available. Let me share images of each variant!',
        'The blue collection is very popular! I can send you photos right away.',
        'Available in Sky Blue, Navy Blue, Royal Blue, and more. Which shade do you prefer?',
      ];
    } else {
      return [
        'Thank you for your interest! How can I help you today?',
        'I would be happy to assist you. What would you like to know more about?',
        'Great question! Let me provide you with all the details.',
      ];
    }
  }
}
