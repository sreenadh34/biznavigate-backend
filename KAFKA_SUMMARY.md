# Kafka AI Integration - Summary

## 📋 What Was Created

### Backend (NestJS) - `biznavigate-backend/`

**New Kafka Module** (`src/features/kafka/`):
- ✅ `kafka.module.ts` - Module configuration
- ✅ `kafka.service.ts` - Core Kafka client (connects, manages topics)
- ✅ `kafka-producer.service.ts` - Publishes events to Kafka
- ✅ `kafka-consumer.service.ts` - Consumes AI results from Kafka
- ✅ `kafka.controller.ts` - REST API for Kafka health/testing

**Configuration Files**:
- ✅ `docker-compose.kafka.yml` - Kafka, Zookeeper, Redis, Kafka UI
- ✅ `KAFKA_AI_INTEGRATION.md` - Architecture documentation
- ✅ `README_KAFKA_INTEGRATION.md` - Complete usage guide
- ✅ `SETUP_KAFKA.md` - Step-by-step setup instructions
- ✅ `install-kafka.ps1` - Installation script

**Integration**:
- ✅ KafkaModule added to `app.module.ts`
- ✅ KafkaModule imported in `lead.module.ts`
- ✅ Example integration in `lead-kafka-integration.example.ts`

### AI Services (Python) - `biznavigate_ai/`

**New Kafka Consumer** (`services/kafka_consumer/`):
- ✅ `main.py` - Kafka consumer that processes lead events with AI
- ✅ `requirements.txt` - Python dependencies (aiokafka, httpx)
- ✅ `.env.example` - Configuration template

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend (NestJS)                         │
│                                                             │
│  Lead Created → Kafka Event → AI Consumer                  │
│  AI Result ← Kafka Event ← AI Processing                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start (Installation Order)

### 1. Install Dependencies

```powershell
# Backend
cd biznavigate-backend
npm install kafkajs

# AI Services
cd ..\biznavigate_ai\services\kafka_consumer
pip install -r requirements.txt
```

### 2. Start Kafka Infrastructure

```powershell
cd ..\..\biznavigate-backend
docker-compose -f docker-compose.kafka.yml up -d
```

This starts:
- Kafka (localhost:9092)
- Kafka UI (http://localhost:8080)
- Zookeeper (localhost:2181)
- Redis (localhost:6379)

### 3. Configure Environment

**Backend `.env` - Add these lines:**
```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-backend
KAFKA_GROUP_ID=biznavigate-backend-group
```

**AI Services `.env` - Create from template:**
```powershell
cd ..\biznavigate_ai\services\kafka_consumer
copy .env.example .env
```

### 4. Start All Services

**Terminal 1 - Backend:**
```powershell
cd biznavigate-backend
npm run start:dev
```

**Terminal 2 - Intent Service:**
```powershell
cd biznavigate_ai\services\intent-service
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

### 5. Test Integration

```powershell
# Check Kafka health
curl http://localhost:3000/kafka/health

# View Kafka UI
start http://localhost:8080

# Send test event
curl -X POST http://localhost:3000/kafka/test -H "Content-Type: application/json" -d "{\"text\":\"I want to buy 2 laptops\"}"
```

## 📊 How It Works

### Event Flow Example

1. **Lead Created:**
   ```
   POST /api/v1/leads → Lead saved → Kafka event published
   ```

2. **AI Processing:**
   ```
   Kafka consumer receives → Calls AI services → Publishes result
   ```

3. **Result Stored:**
   ```
   Backend consumes result → Updates lead → Stores in database
   ```

### Kafka Topics

| Topic | Purpose |
|-------|---------|
| `lead.created` | New lead notifications |
| `lead.message` | New message events |
| `ai.process.request` | Explicit AI processing |
| `ai.process.result` | AI processing completed |
| `ai.error` | AI processing errors |

## 💡 Usage in Your Code

### Automatic AI Processing on Lead Creation

In your `LeadService`, add:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly kafkaProducer: KafkaProducerService, // Add this
) {}

async create(createLeadDto: CreateLeadDto) {
  // 1. Save lead
  const lead = await this.prisma.leads.create({ data: createLeadDto });
  
  // 2. Trigger AI processing via Kafka
  await this.kafkaProducer.publishLeadCreated({
    lead_id: lead.lead_id,
    business_id: lead.business_id,
    tenant_id: lead.tenant_id,
    initial_message: createLeadDto.initial_message,
  });
  
  return lead;
}
```

### Process New Messages

```typescript
async handleMessage(messageDto: any) {
  // Save message
  const message = await this.saveMessage(messageDto);
  
  // Trigger AI analysis
  await this.kafkaProducer.publishLeadMessage({
    lead_id: messageDto.lead_id,
    message_text: messageDto.message_text,
    // ...
  });
}
```

## 📈 Benefits

✅ **Asynchronous** - Don't block lead creation waiting for AI
✅ **Scalable** - Add more AI workers as load increases
✅ **Reliable** - Messages persist in Kafka, auto-retry
✅ **Decoupled** - Backend and AI services independent
✅ **Event-Driven** - React to events in real-time
✅ **Fault Tolerant** - If AI fails, message stays in queue

## 🔍 Monitoring

### Kafka UI
Access: `http://localhost:8080`
- View topics and messages
- Monitor consumer lag
- Inspect message content

### Health Check
```powershell
curl http://localhost:3000/kafka/health
```

### Logs
- Backend: Watch for "Published lead.created event"
- AI Consumer: Watch for "AI processing completed"
- Kafka: `docker-compose logs -f kafka`

## 🔧 Troubleshooting

### Kafka not connecting
```powershell
docker-compose -f docker-compose.kafka.yml restart kafka
```

### Messages not consumed
```powershell
# Check consumer group
docker exec -it biznavigate-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

### Reset consumer offset
```powershell
docker exec -it biznavigate-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group biznavigate-ai-group --reset-offsets --to-earliest --all-topics --execute
```

## 📚 Documentation

- **Architecture**: `KAFKA_AI_INTEGRATION.md`
- **Setup Guide**: `SETUP_KAFKA.md`
- **Complete Guide**: `README_KAFKA_INTEGRATION.md`
- **Code Example**: `src/features/lead/lead-kafka-integration.example.ts`

## 🎯 Next Steps

1. **Install dependencies** (see step 1 above)
2. **Start Kafka** with docker-compose
3. **Configure environment** variables
4. **Start services** (Backend + AI + Consumer)
5. **Test integration** with test endpoint
6. **Monitor** via Kafka UI

## 🚀 Production Deployment

For production:
1. Use managed Kafka (AWS MSK, Confluent Cloud)
2. Enable SASL/SSL authentication
3. Set up monitoring & alerts
4. Configure proper retention policies
5. Scale consumers based on load

## ✅ What's Already Done

- ✅ Kafka module created
- ✅ Producer service implemented
- ✅ Consumer service implemented
- ✅ Python Kafka consumer created
- ✅ Docker Compose configuration
- ✅ Integration examples
- ✅ Complete documentation

## 🎉 Ready to Use!

Just run:
```powershell
.\install-kafka.ps1
docker-compose -f docker-compose.kafka.yml up -d
npm run start:dev
```

Then start the Python Kafka consumer in a separate terminal.

---

**Questions?** Check `README_KAFKA_INTEGRATION.md` for detailed guide.
