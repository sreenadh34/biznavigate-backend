import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaController } from './kafka.controller';
import { KafkaService } from './kafka.service';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Module({
  imports: [ConfigModule],
  controllers: [KafkaController],
  providers: [
    KafkaService,
    KafkaProducerService,
    KafkaConsumerService,
  ],
  exports: [
    KafkaService,
    KafkaProducerService,
    KafkaConsumerService,
  ],
})
export class KafkaModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  async onModuleInit() {
    // Start consuming messages when module initializes
    await this.kafkaConsumerService.consume();
  }

  async onModuleDestroy() {
    // Cleanup Kafka connections
    await this.kafkaConsumerService.disconnect();
  }
}
