import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KafkaService } from './kafka.service';
import { KafkaProducerService } from './kafka-producer.service';

@ApiTags('Kafka')
@Controller('kafka')
export class KafkaController {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check Kafka health' })
  @ApiResponse({ status: 200, description: 'Kafka health status' })
  async checkHealth() {
    const isHealthy = await this.kafkaService.checkHealth();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'kafka',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test')
  @ApiOperation({ summary: 'Send test event to Kafka' })
  @ApiResponse({ status: 200, description: 'Test event sent' })
  async sendTestEvent(@Body() body: any) {
    await this.kafkaProducerService.requestAiProcessing({
      lead_id: body.lead_id || 'test-lead-id',
      business_id: body.business_id || 'test-business-id',
      text: body.text || 'This is a test message',
      business_type: body.business_type || 'retail',
      priority: 'normal',
    });

    return {
      message: 'Test event published to Kafka',
      timestamp: new Date().toISOString(),
    };
  }
}
