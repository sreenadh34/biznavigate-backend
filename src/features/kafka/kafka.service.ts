import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';

/**
 * Core Kafka Service
 * Manages Kafka client, producer, and consumer instances
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');

    const clientId = this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'biznavigate-backend',
    );

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    this.consumer = this.kafka.consumer({
      groupId: this.configService.get<string>(
        'KAFKA_GROUP_ID',
        'biznavigate-backend-group',
      ),
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.admin = this.kafka.admin();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      await this.admin.connect();
      
      this.logger.log('Kafka connected successfully');
      
      // Create topics if they don't exist
      await this.createTopics();
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      await this.admin.disconnect();
      this.logger.log('Kafka disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error);
    }
  }

  /**
   * Create required Kafka topics
   */
  private async createTopics() {
    try {
      const topics = [
        {
          topic: 'lead.created',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'lead.updated',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'lead.message',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'ai.process.request',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'ai.process.result',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'ai.error',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ];

      await this.admin.createTopics({
        topics,
        waitForLeaders: true,
      });

      this.logger.log('Kafka topics created/verified');
    } catch (error) {
      // Topics might already exist, which is fine
      this.logger.debug('Topics creation skipped (might already exist)');
    }
  }

  /**
   * Get Kafka producer instance
   */
  getProducer(): Producer {
    return this.producer;
  }

  /**
   * Get Kafka consumer instance
   */
  getConsumer(): Consumer {
    return this.consumer;
  }

  /**
   * Get Kafka admin instance
   */
  getAdmin(): Admin {
    return this.admin;
  }

  /**
   * Check Kafka health
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.admin.listTopics();
      return true;
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      return false;
    }
  }
}
