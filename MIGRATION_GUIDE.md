# WhatsApp Message Handler V2 - Migration Guide

## Overview

This guide helps you migrate from the current WhatsApp message handler implementation to the new industry-standard V2 architecture.

## What's New in V2?

### 1. **Idempotency & Deduplication**
- Prevents duplicate message processing
- Uses database-backed deduplication with TTL

### 2. **Dead Letter Queue (DLQ)**
- Failed messages are stored for manual review
- Configurable retry attempts with exponential backoff
- Metrics tracking for failures

### 3. **Circuit Breaker Pattern**
- Protects against cascading failures
- Auto-recovery with half-open state testing
- Per-service circuit breakers

### 4. **Strategy Pattern for Intent Handling**
- Each intent has its own dedicated handler class
- Easy to add new intents without modifying existing code
- Confidence-based routing and escalation

### 5. **Saga Pattern for Actions**
- Distributed transaction management
- Automatic compensation/rollback on failures
- Ensures data consistency

### 6. **Comprehensive Observability**
- Distributed tracing with spans
- Business and technical metrics
- Structured logging
- Ready for OpenTelemetry/Prometheus integration

## Architecture Comparison

### Old Architecture
```
WhatsApp Message
  → Kafka
  → AI Processing
  → WhatsAppMessageHandlerService.processAiResult()
  → Switch statement for intent
  → TODO action stubs
  → Basic logging
```

### New Architecture (V2)
```
WhatsApp Message
  → Kafka
  → AI Processing
  → MessageOrchestratorService (Entry point)
      ├── MessageDeduplicatorService (Idempotency)
      ├── IntentHandlerFactory (Strategy Pattern)
      │   ├── OrderRequestHandler
      │   ├── PricingInquiryHandler
      │   ├── ComplaintHandler
      │   └── ... (Extensible)
      ├── ActionExecutorFactory (Saga Pattern)
      │   ├── CreateOrderExecutor (with compensation)
      │   ├── NotifySalesExecutor
      │   ├── CreateSupportTicketExecutor
      │   └── ... (Extensible)
      ├── CircuitBreakerService (Fault tolerance)
      ├── DeadLetterQueueService (Error handling)
      ├── MetricsService (Observability)
      └── TracingService (Distributed tracing)
```

## Migration Steps

### Step 1: Database Schema Updates

Add required tables for deduplication and DLQ:

```prisma
// Add to your schema.prisma

model processed_messages {
  id                String   @id @default(uuid())
  message_id        String   @unique
  lead_id           String
  processing_status String   // success, failed, retrying
  processed_at      DateTime
  expires_at        DateTime
  created_at        DateTime @default(now())

  @@index([expires_at])
  @@index([message_id])
}

model dead_letter_queue {
  id                String   @id @default(uuid())
  message_id        String
  lead_id           String
  original_payload  Json
  error_message     String
  error_stack       String?
  attempt_count     Int
  first_attempt_at  DateTime
  last_attempt_at   DateTime
  status            String   // failed, retrying, resolved
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([status])
  @@index([lead_id])
}

model tasks {
  task_id           String   @id @default(uuid())
  lead_id           String
  business_id       String
  tenant_id         String
  task_type         String   // sales_notification, order_processing, support_ticket, etc.
  title             String
  description       String?
  status            String   // pending, in_progress, completed, cancelled
  priority          String   // low, normal, high, critical
  assigned_to_type  String   // team, role, user
  assigned_to_id    String
  due_date          DateTime?
  metadata          Json?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([lead_id])
  @@index([status])
  @@index([assigned_to_id])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_v2_tables
npx prisma generate
```

### Step 2: Update App Module

Replace the old WhatsAppModule with WhatsAppV2Module:

```typescript
// src/app.module.ts

import { WhatsAppV2Module } from './whatsapp/whatsapp-v2.module';

@Module({
  imports: [
    // ... other modules
    WhatsAppV2Module, // Add this
  ],
})
export class AppModule {}
```

### Step 3: Update Kafka Consumer

Update your Kafka consumer to use the new service:

```typescript
// src/features/kafka/kafka-consumer.service.ts

import { WhatsAppMessageHandlerV2Service } from '../../whatsapp/whatsapp-message-handler-v2.service';

@Injectable()
export class KafkaConsumerService {
  constructor(
    // ... other dependencies
    private readonly whatsappHandlerV2: WhatsAppMessageHandlerV2Service,
  ) {}

  async handleAiResult(payload: any): Promise<void> {
    // Old way:
    // await this.whatsappHandler.processAiResult(payload);

    // New way:
    const result = await this.whatsappHandlerV2.processAiResult(payload);

    if (!result.success) {
      this.logger.error(
        `Failed to process message for lead ${payload.lead_id}`
      );
      // Error already handled by orchestrator (DLQ, retries, etc.)
      return;
    }

    this.logger.log(
      `Successfully processed message for lead ${payload.lead_id}: ` +
      `${result.executedActions.length} actions executed, ` +
      `${result.failedActions.length} failed`
    );

    // Optional: Send response back via WhatsApp
    if (result.shouldRespond && result.responseMessage) {
      // await this.sendWhatsAppResponse(...);
    }
  }
}
```

### Step 4: Implement Actual Action Logic

The V2 architecture includes executor stubs that need implementation. Update these files with your actual business logic:

#### Example: Implement NotifySalesExecutor

```typescript
// src/whatsapp/actions/executors/notify-sales.executor.ts

protected async executeAction(context: ActionContext): Promise<ActionResult> {
  // Replace TODO with actual implementation

  // Send email
  await this.emailService.send({
    to: 'sales@company.com',
    subject: `New ${context.intent} from ${context.leadId}`,
    body: this.formatSalesNotification(context),
  });

  // Send Slack notification
  await this.slackService.postMessage({
    channel: '#sales-leads',
    text: `🔔 New lead activity: ${context.intent}`,
    attachments: [this.formatSlackAttachment(context)],
  });

  // Create task (already implemented)
  const task = await this.prisma.tasks.create({
    data: {
      lead_id: context.leadId,
      business_id: context.businessId,
      tenant_id: context.tenantId,
      task_type: 'sales_notification',
      title: `New ${context.intent} from lead`,
      description: `Lead requires sales attention. Intent: ${context.intent}`,
      status: 'pending',
      priority: 'high',
      assigned_to_type: 'team',
      assigned_to_id: 'sales_team',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        intent: context.intent,
        entities: context.entities,
      } as any,
      created_at: new Date(),
    },
  });

  return this.createSuccessResult('Sales team notified', {
    taskId: task.task_id,
    emailSent: true,
    slackSent: true,
  });
}
```

Repeat for other executors:
- [create-order.executor.ts](src/whatsapp/actions/executors/create-order.executor.ts)
- [create-support-ticket.executor.ts](src/whatsapp/actions/executors/create-support-ticket.executor.ts)
- [flag-for-review.executor.ts](src/whatsapp/actions/executors/flag-for-review.executor.ts)

### Step 5: Add Custom Intent Handlers (Optional)

If you have custom intents, create new handlers:

```typescript
// src/whatsapp/handlers/implementations/custom-intent.handler.ts

import { Injectable } from '@nestjs/common';
import { BaseIntentHandler } from '../base-intent.handler';
import { IntentContext, IntentHandlerResult } from '../intent-handler.interface';

@Injectable()
export class CustomIntentHandler extends BaseIntentHandler {
  constructor() {
    super(CustomIntentHandler.name);
  }

  getIntentType(): string {
    return 'MY_CUSTOM_INTENT';
  }

  getPriority(): number {
    return 7;
  }

  protected async processIntent(
    context: IntentContext
  ): Promise<IntentHandlerResult> {
    // Your custom logic here
    const actions = ['custom_action_1', 'custom_action_2'];
    const message = 'Custom response message';

    return this.createResponse(actions, message, false);
  }
}
```

Register it:

```typescript
// src/whatsapp/handlers/intent-handler-factory.service.ts

import { CustomIntentHandler } from './implementations/custom-intent.handler';

private registerDefaultHandlers(): void {
  this.handlers = [
    new OrderRequestHandler(),
    new PricingInquiryHandler(),
    new CustomIntentHandler(), // Add your custom handler
    // ... other handlers
  ];
  // ...
}
```

### Step 6: Add Custom Action Executors (Optional)

Create custom action executors:

```typescript
// src/whatsapp/actions/executors/custom-action.executor.ts

import { Injectable } from '@nestjs/common';
import { BaseActionExecutor } from '../base-action.executor';
import { ActionContext, ActionResult } from '../action-executor.interface';

@Injectable()
export class CustomActionExecutor extends BaseActionExecutor {
  constructor() {
    super(CustomActionExecutor.name);
  }

  getActionType(): string {
    return 'custom_action_1';
  }

  isRetryable(): boolean {
    return true;
  }

  protected async executeAction(context: ActionContext): Promise<ActionResult> {
    // Your custom action logic
    return this.createSuccessResult('Action completed');
  }

  // Optional: implement compensation
  async compensate(context: ActionContext, originalResult: ActionResult): Promise<void> {
    // Rollback logic
  }
}
```

Register it:

```typescript
// src/whatsapp/actions/action-executor-factory.service.ts

import { CustomActionExecutor } from './executors/custom-action.executor';

private registerDefaultExecutors(): void {
  const defaultExecutors: IActionExecutor[] = [
    new NotifySalesExecutor(this.prisma),
    new CustomActionExecutor(), // Add your custom executor
    // ... other executors
  ];
  // ...
}
```

## Testing

### Unit Tests Example

```typescript
// src/whatsapp/handlers/implementations/order-request.handler.spec.ts

describe('OrderRequestHandler', () => {
  let handler: OrderRequestHandler;

  beforeEach(() => {
    handler = new OrderRequestHandler();
  });

  it('should handle high confidence order requests', async () => {
    const context: IntentContext = {
      leadId: 'lead-123',
      businessId: 'biz-456',
      tenantId: 'tenant-789',
      intent: 'ORDER_REQUEST',
      confidence: 0.95,
      entities: { product: 'Widget X', quantity: '100' },
      originalMessage: 'I need 100 units of Widget X',
    };

    const result = await handler.handle(context);

    expect(result.actions).toContain('create_order');
    expect(result.actions).toContain('notify_sales');
    expect(result.responseMessage).toContain('100 units');
    expect(result.shouldEscalate).toBe(false);
  });
});
```

### Integration Tests Example

```typescript
// src/whatsapp/orchestration/message-orchestrator.service.spec.ts

describe('MessageOrchestratorService', () => {
  let orchestrator: MessageOrchestratorService;
  // ... setup dependencies

  it('should process complete pipeline successfully', async () => {
    const aiResult = {
      processing_id: 'proc-123',
      lead_id: 'lead-123',
      business_id: 'biz-456',
      tenant_id: 'tenant-789',
      intent: { intent: 'ORDER_REQUEST', confidence: 0.9 },
      entities: { product: 'Widget', quantity: '50' },
      suggested_actions: [],
      processing_time_ms: 250,
    };

    const result = await orchestrator.orchestrateMessageProcessing(aiResult);

    expect(result.success).toBe(true);
    expect(result.executedActions.length).toBeGreaterThan(0);
    expect(result.responseMessage).toBeDefined();
  });
});
```

## Monitoring & Observability

### Metrics Dashboard

Key metrics to monitor:

```
# Message Processing
whatsapp.messages.received{business_id, source}
message.duplicate{leadId}

# AI Processing
ai.processing.duration{intent}
ai.intent.detected{intent}
ai.intent.confidence{intent}

# Actions
whatsapp.action.executed{action, status}

# Errors
message.dlq{reason}
circuit_breaker.state{circuit, state}

# Lead Management
lead.state.changed{from, to}
```

### Tracing

View distributed traces to debug issues:

```typescript
// Get trace for a specific message
const traceId = 'trace-123';
const spans = tracingService.getTraceSpans(traceId);

// Visualize the flow:
// message_processing (500ms)
//   ├── deduplication_check (10ms)
//   ├── validation (5ms)
//   ├── intent_processing (120ms)
//   └── action_execution (350ms)
```

## Rollback Plan

If issues occur, rollback by:

1. Revert to old WhatsAppModule in app.module.ts
2. Update Kafka consumer to use old service
3. No data loss - V2 tables are additive

## Performance Considerations

### Before V2
- Single-threaded intent processing
- No deduplication (possible duplicate processing)
- No circuit breaker (cascading failures possible)
- Limited observability

### After V2
- ~10-20ms overhead for deduplication check
- ~5-10ms overhead for tracing
- Circuit breaker prevents cascading failures
- Full observability for debugging
- Saga pattern ensures data consistency

**Overall: Better reliability and debuggability at minimal performance cost**

## Production Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Custom intent handlers implemented
- [ ] Custom action executors implemented
- [ ] Action logic implemented (replace TODOs)
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured
- [ ] DLQ review process established
- [ ] Circuit breaker thresholds tuned
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team trained on new architecture

## Support

For questions or issues during migration:
- Check logs with correlation IDs (traceId)
- Review DLQ for failed messages
- Monitor circuit breaker status
- Check metrics dashboards

## Additional Resources

- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Idempotency in APIs](https://stripe.com/docs/api/idempotent_requests)
