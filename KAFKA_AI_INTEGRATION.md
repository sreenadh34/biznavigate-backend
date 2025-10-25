# Kafka-Based AI Integration Architecture

## Overview

This integration uses **Apache Kafka** as an event streaming platform to connect your NestJS backend with Python AI services. This provides asynchronous, scalable, and fault-tolerant communication.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  BizNavigate Backend (NestJS)                   │
│                           Port 3000                             │
│                                                                 │
│  ┌────────────────────┐         ┌─────────────────────────┐   │
│  │  Lead Service      │────────▶│  Kafka Producer         │   │
│  │  - Create Lead     │         │  - Publish Events       │   │
│  │  - Update Lead     │         └──────────┬──────────────┘   │
│  └────────────────────┘                    │                   │
│                                             │                   │
│  ┌────────────────────┐                    │                   │
│  │  Kafka Consumer    │◀───────────────────┘                   │
│  │  - Process Results │                                        │
│  └────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Apache Kafka
                    ┌─────────▼──────────┐
                    │   Kafka Broker     │
                    │   Port: 9092       │
                    │                    │
                    │  Topics:           │
                    │  - lead.created    │
                    │  - lead.message    │
                    │  - ai.process      │
                    │  - ai.result       │
                    └─────────┬──────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│              BizNavigate AI Services (Python)                   │
│                                                                 │
│  ┌────────────────────┐         ┌─────────────────────────┐   │
│  │  Kafka Consumer    │────────▶│  AI Processing          │   │
│  │  - Listen Events   │         │  - Intent Detection     │   │
│  │                    │         │  - Entity Extraction    │   │
│  └────────────────────┘         │  - LLM Generation       │   │
│                                  └──────────┬──────────────┘   │
│  ┌────────────────────┐                    │                   │
│  │  Kafka Producer    │◀───────────────────┘                   │
│  │  - Publish Results │                                        │
│  └────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Event Flow

1. **Lead Created** → Backend publishes to `lead.created` topic
2. **AI Service** consumes event and processes
3. **AI Result** → AI publishes to `ai.result` topic
4. **Backend** consumes result and updates database

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `lead.created` | Backend | AI Service | New lead created |
| `lead.updated` | Backend | AI Service | Lead information updated |
| `lead.message` | Backend | AI Service | New message from lead |
| `ai.process.request` | Backend | AI Service | Explicit AI processing request |
| `ai.process.result` | AI Service | Backend | AI processing completed |
| `ai.error` | AI Service | Backend | AI processing failed |

## Message Schemas

### lead.created
```json
{
  "event_id": "uuid",
  "event_type": "lead.created",
  "timestamp": "2025-10-25T10:30:00Z",
  "payload": {
    "lead_id": "uuid",
    "business_id": "uuid",
    "tenant_id": "uuid",
    "source": "whatsapp",
    "platform_user_id": "919876543210",
    "initial_message": "I want to order 2 laptops",
    "metadata": {}
  }
}
```

### lead.message
```json
{
  "event_id": "uuid",
  "event_type": "lead.message",
  "timestamp": "2025-10-25T10:30:00Z",
  "payload": {
    "lead_id": "uuid",
    "business_id": "uuid",
    "message_id": "uuid",
    "message_text": "What's the price?",
    "direction": "inbound",
    "metadata": {}
  }
}
```

### ai.process.result
```json
{
  "event_id": "uuid",
  "event_type": "ai.process.result",
  "timestamp": "2025-10-25T10:30:00Z",
  "payload": {
    "lead_id": "uuid",
    "business_id": "uuid",
    "processing_id": "uuid",
    "intent": {
      "intent": "ORDER_REQUEST",
      "confidence": 0.95,
      "tier": "rules"
    },
    "entities": {
      "products": ["laptop"],
      "quantities": [{"value": 2}]
    },
    "suggested_actions": ["send_catalog", "request_details"],
    "suggested_response": "Thank you for your interest...",
    "processing_time_ms": 150
  }
}
```

## Setup Instructions

### 1. Install Kafka

**Using Docker (Recommended):**
```bash
# Create docker-compose.kafka.yml in project root
docker-compose -f docker-compose.kafka.yml up -d
```

**Or use Confluent Cloud (Managed Kafka)**

### 2. Install Dependencies

**Backend (NestJS):**
```bash
npm install kafkajs
npm install --save-dev @types/kafkajs
```

**AI Services (Python):**
```bash
cd ../biznavigate_ai
pip install aiokafka
```

### 3. Configure Environment

**Backend `.env`:**
```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-backend
KAFKA_GROUP_ID=biznavigate-backend-group
KAFKA_SASL_USERNAME=  # If using auth
KAFKA_SASL_PASSWORD=  # If using auth
```

**AI Services `.env`:**
```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-ai
KAFKA_GROUP_ID=biznavigate-ai-group
```

## Implementation Files

See the following files created:
- Backend: `src/features/kafka/` - Kafka module and services
- AI Services: `services/kafka-consumer/` - Kafka consumer service
- Config: `docker-compose.kafka.yml` - Kafka setup

## Benefits

✅ **Asynchronous Processing** - Non-blocking operations
✅ **Scalability** - Horizontal scaling of consumers
✅ **Fault Tolerance** - Message persistence and replay
✅ **Decoupling** - Services are independent
✅ **Event Sourcing** - Complete audit trail
✅ **Real-time** - Low latency event processing
✅ **Reliability** - Guaranteed message delivery

## Monitoring

- **Kafka UI**: http://localhost:8080 (if using kafka-ui)
- **Metrics**: Track consumer lag, throughput
- **Logging**: Centralized logging of all events

## Testing

```bash
# Test Kafka connectivity
npm run test:kafka

# Send test event
curl -X POST http://localhost:3000/kafka/test
```
