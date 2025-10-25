# AI Integration with Kafka - Complete Guide

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                  Your Application Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User creates lead via WhatsApp/Instagram/Website           │
│  2. Backend saves lead to PostgreSQL                            │
│  3. Backend publishes event to Kafka                            │
│  4. AI service consumes event from Kafka                        │
│  5. AI processes (intent + entities)                            │
│  6. AI publishes result to Kafka                                │
│  7. Backend consumes result from Kafka                          │
│  8. Backend updates lead with AI insights                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits of Kafka Integration

✅ **Asynchronous Processing** - Don't block lead creation
✅ **Scalability** - Add more AI workers as needed
✅ **Reliability** - Messages persist in Kafka
✅ **Decoupling** - Backend and AI services independent
✅ **Event Sourcing** - Complete audit trail
✅ **Fault Tolerance** - Auto-retry failed messages

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Backend)
- Python 3.10+ (AI Services)
- Docker & Docker Compose (Kafka)
- PostgreSQL (Database)
- Redis (Caching)

### 1. Start Infrastructure

```powershell
cd biznavigate-backend

# Start Kafka, Zookeeper, Redis, Kafka UI
docker-compose -f docker-compose.kafka.yml up -d

# Verify services
docker-compose -f docker-compose.kafka.yml ps
```

Services available:
- Kafka: `localhost:9092`
- Kafka UI: `http://localhost:8080`
- Redis: `localhost:6379`
- Zookeeper: `localhost:2181`

### 2. Install Dependencies

**Backend:**
```powershell
npm install kafkajs
```

**AI Services:**
```powershell
cd ..\biznavigate_ai\services\kafka_consumer
pip install -r requirements.txt
```

### 3. Configure Environment

**Backend `.env`:**
```env
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-backend
KAFKA_GROUP_ID=biznavigate-backend-group

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/biznavigate

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**AI Services `.env`:**
```env
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=biznavigate-ai-group

INTENT_SERVICE_URL=http://localhost:8001
ENTITY_SERVICE_URL=http://localhost:8002
LLM_SERVICE_URL=http://localhost:3000

# API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### 4. Start Services

**Terminal 1 - Backend:**
```powershell
npm run start:dev
```

**Terminal 2 - Intent Service:**
```powershell
cd ..\biznavigate_ai\services\intent-service
python run_single_worker.py
```

**Terminal 3 - Entity Service:**
```powershell
cd ..\entity-service
python main.py
```

**Terminal 4 - Kafka AI Consumer:**
```powershell
cd ..\kafka_consumer
python main.py
```

## 📦 Installation Details

### Backend Setup

1. **Install Kafka package:**
```powershell
npm install kafkajs
npm install --save-dev @types/kafkajs
```

2. **The Kafka module is already created** in `src/features/kafka/`:
   - `kafka.module.ts` - Module definition
   - `kafka.service.ts` - Core Kafka client
   - `kafka-producer.service.ts` - Event publisher
   - `kafka-consumer.service.ts` - Event consumer
   - `kafka.controller.ts` - REST endpoints

3. **Kafka is already integrated** in `src/app.module.ts`

### AI Services Setup

1. **Install dependencies:**
```powershell
cd biznavigate_ai\services\kafka_consumer
pip install aiokafka httpx aiohttp
```

2. **Consumer is ready** at `services/kafka_consumer/main.py`

## ⚙️ Configuration

### Kafka Topics

| Topic | Purpose | Producer | Consumer |
|-------|---------|----------|----------|
| `lead.created` | New lead created | Backend | AI Service |
| `lead.updated` | Lead information changed | Backend | AI Service |
| `lead.message` | New message received | Backend | AI Service |
| `ai.process.request` | Explicit AI processing | Backend | AI Service |
| `ai.process.result` | AI processing complete | AI Service | Backend |
| `ai.error` | AI processing failed | AI Service | Backend |

### Consumer Groups

- `biznavigate-backend-group` - Backend consumers
- `biznavigate-ai-group` - AI service consumers

## 💻 Usage Examples

### Example 1: Automatic AI Processing on Lead Creation

In your `LeadService`, the Kafka integration happens automatically:

```typescript
// src/features/lead/application/services/lead.service.ts

import { Injectable } from '@nestjs/common';
import { KafkaProducerService } from '../../../kafka/kafka-producer.service';

@Injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(createLeadDto: CreateLeadDto, tenantId: string) {
    // 1. Create lead in database
    const lead = await this.prisma.leads.create({
      data: {
        ...createLeadDto,
        tenant_id: tenantId,
      },
    });

    // 2. Publish to Kafka (non-blocking)
    this.kafkaProducer
      .publishLeadCreated({
        lead_id: lead.lead_id,
        business_id: lead.business_id,
        tenant_id: tenantId,
        source: lead.source,
        initial_message: createLeadDto.initial_message,
      })
      .catch((err) => this.logger.error('Kafka publish failed', err));

    return lead;
  }
}
```

### Example 2: Process New Message

```typescript
async handleNewMessage(messageDto: any) {
  // Save message
  const message = await this.prisma.lead_messages.create({
    data: messageDto,
  });

  // Publish to Kafka for AI processing
  await this.kafkaProducer.publishLeadMessage({
    lead_id: messageDto.lead_id,
    business_id: messageDto.business_id,
    message_id: message.message_id,
    message_text: messageDto.message_text,
    direction: 'inbound',
  });

  return message;
}
```

### Example 3: Explicit AI Analysis Request

```typescript
async analyzeLeadWithAI(leadId: string) {
  const lead = await this.prisma.leads.findUnique({
    where: { lead_id: leadId },
  });

  await this.kafkaProducer.requestAiProcessing({
    lead_id: leadId,
    business_id: lead.business_id,
    text: lead.initial_message,
    priority: 'high',
  });

  return { message: 'AI analysis requested' };
}
```

### Example 4: Test Kafka Integration

```typescript
// POST /kafka/test
{
  "text": "I want to order 2 laptops",
  "lead_id": "test-lead-123",
  "business_id": "test-business-456"
}
```

## 📊 Monitoring

### Kafka UI Dashboard

Access: `http://localhost:8080`

Features:
- View all topics
- Inspect messages
- Monitor consumer lag
- Check consumer groups
- View broker status

### Check Kafka Health

```powershell
curl http://localhost:3000/kafka/health
```

Response:
```json
{
  "status": "healthy",
  "service": "kafka",
  "timestamp": "2025-10-25T10:30:00Z"
}
```

### View Logs

**Backend logs:**
```powershell
npm run start:dev
# Look for: "Published lead.created event"
```

**AI Consumer logs:**
```powershell
python main.py
# Look for: "Received event: lead.created"
# Look for: "AI processing completed"
```

**Kafka logs:**
```powershell
docker-compose -f docker-compose.kafka.yml logs -f kafka
```

### Monitor Consumer Lag

```powershell
docker exec -it biznavigate-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group biznavigate-ai-group \
  --describe
```

## 🔧 Troubleshooting

### Issue: Kafka connection refused

**Symptom:** `Connection refused to localhost:9092`

**Solution:**
```powershell
# Check Kafka status
docker-compose -f docker-compose.kafka.yml ps

# Restart Kafka
docker-compose -f docker-compose.kafka.yml restart kafka

# Check logs
docker-compose -f docker-compose.kafka.yml logs kafka
```

### Issue: Messages not being consumed

**Symptom:** Events published but not processed

**Solution:**
```powershell
# Check if consumer is running
# AI consumer should show: "Kafka consumer started"

# Check consumer group
docker exec -it biznavigate-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list

# Reset consumer offset if needed
docker exec -it biznavigate-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group biznavigate-ai-group \
  --reset-offsets \
  --to-earliest \
  --all-topics \
  --execute
```

### Issue: AI services not responding

**Symptom:** `HTTP connection errors` in AI consumer

**Solution:**
```powershell
# Check AI services are running
curl http://localhost:8001/health  # Intent
curl http://localhost:8002/health  # Entity
curl http://localhost:3000/health  # LLM

# Start services if needed
cd biznavigate_ai\services\intent-service
python run_single_worker.py
```

### Issue: Port already in use

**Symptom:** `Port 9092 is already allocated`

**Solution:**
```powershell
# Stop all containers
docker-compose -f docker-compose.kafka.yml down

# Remove volumes
docker-compose -f docker-compose.kafka.yml down -v

# Start fresh
docker-compose -f docker-compose.kafka.yml up -d
```

## 📈 Performance Tuning

### Increase Throughput

1. **Add more partitions:**
```powershell
docker exec -it biznavigate-kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --alter --topic lead.created \
  --partitions 6
```

2. **Run multiple AI consumers:**
```powershell
# Terminal 1
python main.py

# Terminal 2 (same group, different instance)
python main.py
```

3. **Tune Kafka settings:**
Edit `docker-compose.kafka.yml`:
```yaml
KAFKA_NUM_NETWORK_THREADS: 8
KAFKA_NUM_IO_THREADS: 8
KAFKA_SOCKET_SEND_BUFFER_BYTES: 102400
KAFKA_SOCKET_RECEIVE_BUFFER_BYTES: 102400
```

### Optimize AI Processing

1. **Use caching** for repeated queries
2. **Batch processing** for multiple leads
3. **Priority queues** for urgent leads
4. **Load balancing** across AI service instances

## 🛡️ Security

### Production Recommendations

1. **Enable SASL/SSL for Kafka:**
```yaml
# docker-compose.kafka.yml
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: SASL_SSL:SASL_SSL
KAFKA_SASL_MECHANISM_INTER_BROKER_PROTOCOL: PLAIN
```

2. **Use Kafka ACLs:**
```powershell
docker exec -it biznavigate-kafka kafka-acls \
  --bootstrap-server localhost:9092 \
  --add --allow-principal User:backend \
  --operation Write --topic lead.created
```

3. **Encrypt sensitive data** in messages
4. **Use API Gateway** for external access
5. **Enable authentication** on Kafka UI

## 🚀 Production Deployment

### Using Managed Kafka (Recommended)

Consider using:
- **Confluent Cloud**
- **AWS MSK (Managed Streaming for Kafka)**
- **Azure Event Hubs**

### Docker Deployment

```powershell
# Build backend
docker build -t biznavigate-backend .

# Build AI consumer
docker build -t biznavigate-ai-consumer ./biznavigate_ai/services/kafka_consumer

# Run with docker-compose
docker-compose up -d
```

## 📚 Additional Resources

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [KafkaJS Guide](https://kafka.js.org/docs/getting-started)
- [aiokafka Documentation](https://aiokafka.readthedocs.io/)
- [KAFKA_AI_INTEGRATION.md](./KAFKA_AI_INTEGRATION.md) - Architecture details
- [SETUP_KAFKA.md](./SETUP_KAFKA.md) - Step-by-step setup

## 🤝 Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review Kafka UI at `http://localhost:8080`
3. Check service logs
4. Verify configuration

---

**Last Updated:** October 25, 2025
**Version:** 1.0.0
