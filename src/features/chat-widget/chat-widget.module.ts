import { Module } from '@nestjs/common';
import { ChatWidgetController } from './chat-widget.controller';
import { ChatWidgetService } from './chat-widget.service';
import { ChatWidgetGateway } from './chat-widget.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Module({
  controllers: [ChatWidgetController],
  providers: [ChatWidgetService, ChatWidgetGateway, PrismaService, KafkaProducerService],
  exports: [ChatWidgetService, ChatWidgetGateway],
})
export class ChatWidgetModule {}
