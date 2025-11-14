import { Module } from "@nestjs/common";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppMessageHandlerService } from "./whatsapp-message-handler.service";
import { KafkaModule } from "src/features/kafka/kafka.module";
import { PrismaModule } from "src/prisma/prisma.module";

// Infrastructure Services
import { MessageDeduplicatorService } from './infrastructure/message-deduplicator.service';
import { DeadLetterQueueService } from './infrastructure/dead-letter-queue.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';

// Intent Handlers
import { IntentHandlerFactoryService } from './handlers/intent-handler-factory.service';

// Action Executors
import { ActionExecutorFactoryService } from './actions/action-executor-factory.service';

// Observability
import { MetricsService, WhatsAppMetricsService } from './observability/metrics.service';
import { TracingService } from './observability/tracing.service';

// Orchestration
import { MessageOrchestratorService } from './orchestration/message-orchestrator.service';

/**
 * WhatsApp Module - REFACTORED with Industry Standard Patterns
 *
 * New architecture includes:
 * - Infrastructure: DLQ, Circuit Breaker, Deduplication
 * - Strategy Pattern: Intent handlers
 * - Saga Pattern: Action executors with compensation
 * - Observability: Metrics, Tracing, Structured Logging
 *
 * Backward Compatible: Existing code continues to work
 */
@Module({
  imports: [KafkaModule, PrismaModule],
  controllers: [WhatsAppController],
  providers: [
    // Original services
    WhatsAppService,
    WhatsAppMessageHandlerService,

    // Infrastructure
    MessageDeduplicatorService,
    DeadLetterQueueService,
    CircuitBreakerService,

    // Factories
    IntentHandlerFactoryService,
    ActionExecutorFactoryService,

    // Observability
    MetricsService,
    WhatsAppMetricsService,
    TracingService,

    // Orchestration
    MessageOrchestratorService,
  ],
  exports: [
    WhatsAppService,
    WhatsAppMessageHandlerService,
    CircuitBreakerService,
    MetricsService,
    WhatsAppMetricsService,
    TracingService,
  ],
})
export class WhatsAppModule {}
