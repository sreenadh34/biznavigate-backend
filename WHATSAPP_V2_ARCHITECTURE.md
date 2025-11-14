# WhatsApp Message Handler V2 - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Component Structure](#component-structure)
4. [Message Flow](#message-flow)
5. [Design Patterns](#design-patterns)
6. [Error Handling](#error-handling)
7. [Observability](#observability)
8. [Scalability](#scalability)

---

## Overview

The WhatsApp Message Handler V2 is an enterprise-grade, event-driven system for processing AI-analyzed WhatsApp messages with automatic intent detection and action execution.

### Key Improvements Over V1

| Feature | V1 (Old) | V2 (New) |
|---------|----------|----------|
| **Idempotency** | ❌ None | ✅ Database-backed deduplication |
| **Error Handling** | ❌ Log and fail | ✅ DLQ + retry with backoff |
| **Fault Tolerance** | ❌ None | ✅ Circuit breaker pattern |
| **Intent Handling** | ❌ Switch statements | ✅ Strategy pattern (pluggable) |
| **Action Execution** | ❌ TODO stubs | ✅ Saga pattern with compensation |
| **Observability** | ❌ Basic logging | ✅ Metrics + tracing + logging |
| **Extensibility** | ⚠️ Hard to extend | ✅ Factory pattern (easy plugins) |
| **Transaction Safety** | ❌ No rollback | ✅ Automatic compensation |

---

## Architecture Patterns

### 1. Event-Driven Architecture

```
┌─────────────┐
│  WhatsApp   │
│   Message   │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Kafka     │ ◄── Async, decoupled communication
│   Broker    │
└──────┬──────┘
       │
       ├──► ai.process.request (to AI service)
       │
       └──► ai.process.result (from AI service)
              │
              v
       ┌──────────────┐
       │ Orchestrator │
       └──────────────┘
```

**Benefits:**
- Decoupled services
- Async processing
- Natural backpressure handling
- Event replay capability

### 2. Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│              (Kafka Consumer Handler)                │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────v──────────────────────────┐
│              Orchestration Layer                     │
│           (MessageOrchestratorService)              │
│  - Coordinates entire pipeline                      │
│  - Manages transactions (Saga)                      │
└──────────────────────────┬──────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────v──────┐    ┌───────v──────┐   ┌───────v──────┐
│  Business   │    │Infrastructure│   │ Observability│
│   Logic     │    │    Layer     │   │    Layer     │
│             │    │              │   │              │
│ - Intent    │    │ - DLQ        │   │ - Metrics    │
│   Handlers  │    │ - Circuit    │   │ - Tracing    │
│ - Action    │    │   Breaker    │   │ - Logging    │
│   Executors │    │ - Dedupe     │   │              │
└─────────────┘    └──────────────┘   └──────────────┘
                           │
┌──────────────────────────v──────────────────────────┐
│                  Data Access Layer                   │
│                  (Prisma/Database)                   │
└─────────────────────────────────────────────────────┘
```

---

## Component Structure

### Directory Layout

```
src/whatsapp/
├── infrastructure/              # Infrastructure patterns
│   ├── message-deduplicator.service.ts
│   ├── dead-letter-queue.service.ts
│   └── circuit-breaker.service.ts
│
├── handlers/                    # Intent handling (Strategy pattern)
│   ├── intent-handler.interface.ts
│   ├── base-intent.handler.ts
│   ├── intent-handler-factory.service.ts
│   └── implementations/
│       ├── order-request.handler.ts
│       ├── pricing-inquiry.handler.ts
│       ├── complaint.handler.ts
│       ├── availability-inquiry.handler.ts
│       ├── schedule-call.handler.ts
│       └── unknown-intent.handler.ts
│
├── actions/                     # Action execution (Saga pattern)
│   ├── action-executor.interface.ts
│   ├── base-action.executor.ts
│   ├── action-executor-factory.service.ts
│   └── executors/
│       ├── notify-sales.executor.ts
│       ├── create-order.executor.ts
│       ├── create-support-ticket.executor.ts
│       └── flag-for-review.executor.ts
│
├── observability/               # Monitoring & debugging
│   ├── metrics.service.ts
│   └── tracing.service.ts
│
├── orchestration/               # Workflow coordination
│   └── message-orchestrator.service.ts
│
├── whatsapp-message-handler-v2.service.ts  # Main entry point
└── whatsapp-v2.module.ts                    # NestJS module
```

---

## Message Flow

### Complete Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGE PROCESSING PIPELINE                 │
└─────────────────────────────────────────────────────────────────┘

1️⃣  KAFKA MESSAGE ARRIVES
    ↓
    ┌─────────────────────────────────────┐
    │ Kafka Consumer receives AI result   │
    │ - processing_id                     │
    │ - lead_id, business_id, tenant_id   │
    │ - intent + confidence               │
    │ - entities                          │
    └─────────────┬───────────────────────┘
                  │
                  ↓
2️⃣  ORCHESTRATOR ENTRY POINT
    ┌──────────────────────────────────────┐
    │ MessageOrchestratorService           │
    │ - Start distributed trace            │
    └─────────────┬────────────────────────┘
                  │
                  ↓
3️⃣  IDEMPOTENCY CHECK
    ┌──────────────────────────────────────┐
    │ MessageDeduplicatorService           │
    │ - Check processed_messages table     │
    │ - If duplicate → Skip processing     │
    │ - If new → Continue                  │
    └─────────────┬────────────────────────┘
                  │
                  ↓
4️⃣  VALIDATION
    ┌──────────────────────────────────────┐
    │ Validate AI Result Structure         │
    │ - Required fields present?           │
    │ - tenant_id resolution               │
    └─────────────┬────────────────────────┘
                  │
                  ↓
5️⃣  METRICS TRACKING
    ┌──────────────────────────────────────┐
    │ Track AI Processing Metrics          │
    │ - Processing time                    │
    │ - Intent detected                    │
    │ - Confidence score                   │
    └─────────────┬────────────────────────┘
                  │
                  ↓
6️⃣  INTENT PROCESSING (Strategy Pattern)
    ┌──────────────────────────────────────┐
    │ IntentHandlerFactory                 │
    │ - Select appropriate handler         │
    │   based on intent type               │
    └─────────────┬────────────────────────┘
                  │
         ┌────────┴────────┬───────────┬──────────┐
         │                 │           │          │
    ┌────v─────┐    ┌─────v──┐   ┌────v──┐  ┌───v────┐
    │  Order   │    │Pricing │   │Complaint│  │ ... │
    │ Handler  │    │Handler │   │Handler │  │     │
    └────┬─────┘    └─────┬──┘   └────┬──┘  └───┬────┘
         │                 │           │          │
         └────────┬────────┴───────────┴──────────┘
                  │
                  ↓
         ┌────────────────────────────┐
         │ IntentHandlerResult        │
         │ - actions: string[]        │
         │ - responseMessage: string  │
         │ - shouldEscalate: boolean  │
         └────────┬───────────────────┘
                  │
                  ↓
7️⃣  ACTION EXECUTION (Saga Pattern)
    ┌──────────────────────────────────────┐
    │ Action Execution Loop                │
    │ - Execute actions sequentially       │
    │ - Track executed vs failed           │
    │ - Compensate on failure              │
    └─────────────┬────────────────────────┘
                  │
         ┌────────┴────────┬───────────┬──────────┐
         │                 │           │          │
    ┌────v─────┐    ┌─────v──┐   ┌────v──┐  ┌───v────┐
    │ Circuit  │    │Circuit │   │Circuit│  │Circuit │
    │ Breaker  │    │Breaker │   │Breaker│  │Breaker │
    │    ↓     │    │   ↓    │   │   ↓   │  │   ↓    │
    │  Order   │    │ Notify │   │Ticket │  │  Flag  │
    │ Executor │    │  Sales │   │Executor│  │Executor│
    └────┬─────┘    └─────┬──┘   └────┬──┘  └───┬────┘
         │                 │           │          │
         │   ✅ Success    │  ❌ Failed │          │
         └────────┬────────┴───────────┴──────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
   ✅ All Success        ❌ Any Failure
       │                     │
       ↓                     ↓
8️⃣  SUCCESS PATH        COMPENSATION PATH
    ┌──────────┐         ┌──────────────────┐
    │ Mark as  │         │ Saga Compensation│
    │Processed │         │ - Rollback in    │
    │          │         │   reverse order  │
    │ Log      │         │ - Call compensate()│
    │Activity  │         │   on executors   │
    │          │         └────────┬─────────┘
    │ Track    │                  │
    │Metrics   │                  ↓
    └────┬─────┘         ┌────────────────┐
         │               │ Send to DLQ    │
         │               │ - Store error  │
         │               │ - Schedule     │
         │               │   retry        │
         │               └────────────────┘
         │
         ↓
9️⃣  RESPONSE
    ┌──────────────────────────────────────┐
    │ Return Result                        │
    │ - success: boolean                   │
    │ - responseMessage: string            │
    │ - executedActions: string[]          │
    │ - failedActions: string[]            │
    └──────────────────────────────────────┘
         │
         ↓
🔟 SEND WHATSAPP RESPONSE (optional)
    ┌──────────────────────────────────────┐
    │ WhatsApp API Call                    │
    │ - Send response message to customer  │
    │ - Log delivery status                │
    └──────────────────────────────────────┘
```

---

## Design Patterns

### 1. Strategy Pattern (Intent Handlers)

**Problem:** Different intents require different processing logic.

**Solution:** Each intent has its own handler class implementing a common interface.

```typescript
interface IIntentHandler {
  getIntentType(): string;
  canHandle(context: IntentContext): boolean;
  handle(context: IntentContext): Promise<IntentHandlerResult>;
  getPriority(): number;
}

// Factory selects appropriate handler at runtime
const handler = intentHandlerFactory.getHandler(context);
const result = await handler.handle(context);
```

**Benefits:**
- ✅ Easy to add new intents (no code modification)
- ✅ Each handler is independently testable
- ✅ Confidence-based routing
- ✅ Priority-based selection

### 2. Saga Pattern (Action Execution)

**Problem:** Multiple actions must execute atomically, but they're distributed across different systems.

**Solution:** Execute actions sequentially with compensation logic.

```typescript
interface IActionExecutor {
  execute(context): Promise<ActionResult>;
  compensate?(context, result): Promise<void>;  // Rollback
  isRetryable(): boolean;
}

// Execution
for (const action of actions) {
  const result = await executor.execute(context);
  if (!result.success) {
    // Compensate all previously executed actions
    await compensatePreviousActions();
    break;
  }
  executedActions.push({ action, result });
}
```

**Benefits:**
- ✅ Data consistency across distributed systems
- ✅ Automatic rollback on failure
- ✅ Idempotent operations
- ✅ Partial failure handling

### 3. Circuit Breaker Pattern

**Problem:** When external service fails, repeated calls cause cascading failures.

**Solution:** Monitor failure rate and "open" circuit to prevent further calls.

```
States:
┌────────┐  Failures     ┌──────┐  Timeout    ┌───────────┐
│ CLOSED │──exceed───────▶│ OPEN │──elapsed────▶│ HALF_OPEN │
│        │  threshold     │      │              │           │
└────────┘                └──────┘              └─────┬─────┘
    ▲                                                 │
    │                  Success                        │
    └─────────────────threshold────────────────────  │
                        met                           │
                                                      │
                        Failure                       │
                      ◄─────────────────────────────  │
```

**Benefits:**
- ✅ Prevents cascading failures
- ✅ Auto-recovery
- ✅ Graceful degradation
- ✅ Per-service isolation

### 4. Factory Pattern

**Problem:** Creating handlers/executors requires complex initialization.

**Solution:** Centralized factory manages creation and registration.

```typescript
@Injectable()
export class IntentHandlerFactoryService {
  private handlers: IIntentHandler[] = [];

  registerHandler(handler: IIntentHandler): void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => b.getPriority() - a.getPriority());
  }

  getHandler(context: IntentContext): IIntentHandler {
    return this.handlers.find(h => h.canHandle(context)) || fallback;
  }
}
```

**Benefits:**
- ✅ Centralized configuration
- ✅ Easy plugin registration
- ✅ Dependency injection friendly
- ✅ Testability

---

## Error Handling

### Error Handling Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     ERROR OCCURS                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴───────────────┐
                │                              │
        ┌───────v────────┐           ┌────────v─────────┐
        │ Retryable Error│           │Non-retryable Error│
        │ (Network, etc) │           │(Validation, etc) │
        └───────┬────────┘           └────────┬─────────┘
                │                              │
         ┌──────v──────┐                      │
         │ Attempt < 3?│                      │
         └──────┬──────┘                      │
           Yes  │  No                         │
         ┌──────v────┬─────────────────────┐ │
         │           │                     │ │
    ┌────v───┐  ┌───v────┐           ┌────v─v───────┐
    │ Retry  │  │  Send  │           │ Compensate   │
    │ with   │  │  to    │           │ executed     │
    │Backoff │  │  DLQ   │           │ actions      │
    └────────┘  └────────┘           └──────┬───────┘
                                            │
                                     ┌──────v────────┐
                                     │  Send to DLQ  │
                                     │  - Store error│
                                     │  - Alert team │
                                     └───────────────┘
```

### Dead Letter Queue (DLQ)

Failed messages are stored for:
- Manual review by operations team
- Root cause analysis
- Manual retry after fixing underlying issue
- Regulatory compliance (audit trail)

```sql
SELECT * FROM dead_letter_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 100;
```

### Retry Strategy

```typescript
Attempt 1: Immediate retry (1 second delay)
Attempt 2: 5 seconds delay
Attempt 3: 15 seconds delay
Attempt 4+: Send to DLQ
```

---

## Observability

### 1. Metrics (Business + Technical)

#### Business Metrics
```
whatsapp.messages.received{business_id, source}
ai.intent.detected{intent}
ai.intent.confidence{intent}
whatsapp.action.executed{action, status}
lead.state.changed{from, to}
```

#### Technical Metrics
```
ai.processing.duration{intent}           # Histogram
message.duplicate{leadId}                # Counter
message.dlq{reason}                      # Counter
circuit_breaker.state{circuit, state}   # Gauge
action.compensation{action}              # Counter
```

### 2. Distributed Tracing

Each message processing creates a trace with spans:

```
Trace ID: abc123
├─ Span: message_processing (500ms) [ROOT]
   ├─ Span: deduplication_check (10ms)
   ├─ Span: validation (5ms)
   ├─ Span: fetch_tenant_id (30ms)
   ├─ Span: intent_processing (120ms)
   │  └─ Span: order_request_handler (115ms)
   └─ Span: action_execution (350ms)
      ├─ Span: create_order (180ms)
      └─ Span: notify_sales (160ms)
```

### 3. Structured Logging

```json
{
  "timestamp": "2025-01-24T10:30:00.000Z",
  "level": "info",
  "service": "whatsapp-handler-v2",
  "traceId": "abc123",
  "spanId": "xyz789",
  "leadId": "lead-123",
  "intent": "ORDER_REQUEST",
  "confidence": 0.95,
  "message": "Processing AI result for lead",
  "duration_ms": 450
}
```

---

## Scalability

### Horizontal Scaling

```
┌──────────────┐
│    Kafka     │
│   Broker     │
└──────┬───────┘
       │
   ┌───┴────┬─────────┬─────────┐
   │        │         │         │
┌──▼──┐  ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│Inst1│  │Inst2│  │Inst3│  │Inst4│  ← Multiple consumer instances
└──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘    (Kafka consumer group)
   │        │         │         │
   └────────┴─────────┴─────────┘
            │
      ┌─────▼─────┐
      │ Database  │
      └───────────┘
```

### Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Deduplication Check | 5-10ms | Database query |
| Intent Processing | 50-150ms | In-memory, fast |
| Action Execution | 100-500ms | Depends on action |
| Total Pipeline | 200-800ms | End-to-end |

### Bottlenecks & Solutions

| Bottleneck | Solution |
|------------|----------|
| Database queries | Connection pooling, read replicas |
| Action execution | Async processing, batch operations |
| Circuit breaker state | In-memory cache (Redis) |
| Metrics tracking | Async batch writes |

---

## Security Considerations

### 1. Input Validation
- All AI results validated before processing
- Entity extraction sanitized
- SQL injection prevention (Prisma ORM)

### 2. Idempotency
- Prevents replay attacks
- Deduplication with TTL

### 3. Audit Trail
- All actions logged to `lead_activities`
- Immutable activity log
- Compliance-ready

### 4. Error Information Leakage
- Sensitive error details logged, not returned
- Generic error messages to external systems

---

## Future Enhancements

### Planned Improvements

1. **Event Sourcing**
   - Store all events, not just current state
   - Enable time-travel debugging
   - Support for replay

2. **CQRS (Command Query Responsibility Segregation)**
   - Separate read/write models
   - Optimized read paths

3. **Advanced Circuit Breaker**
   - Adaptive thresholds
   - Bulkhead pattern
   - Rate limiting per tenant

4. **Machine Learning Integration**
   - A/B testing for intents
   - Confidence threshold optimization
   - Automated action selection

5. **Real-time Notifications**
   - WebSocket for live updates
   - Push notifications to agents
   - Dashboard with live metrics

---

## Conclusion

The WhatsApp V2 architecture provides:

✅ **Reliability** - Circuit breakers, retries, DLQ
✅ **Consistency** - Saga pattern with compensation
✅ **Observability** - Metrics, tracing, structured logs
✅ **Extensibility** - Strategy and factory patterns
✅ **Scalability** - Horizontal scaling ready
✅ **Maintainability** - Clean code, SOLID principles

This is a **production-ready, enterprise-grade** solution for event-driven message processing.
