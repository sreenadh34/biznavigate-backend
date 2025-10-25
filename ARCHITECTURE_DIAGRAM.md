# 🏗️ Complete System Architecture - Kafka AI Integration

## 📊 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTIONS                                │
│                                                                          │
│   📱 WhatsApp    📷 Instagram    🌐 Website    📞 Phone Calls           │
│                                                                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP/Webhooks
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BIZNAVIGATE BACKEND (NestJS)                         │
│                         Port: 3000                                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  API Gateway                                                     │  │
│  │  - Authentication (JWT)                                          │  │
│  │  - Request validation                                            │  │
│  │  - Rate limiting                                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                             │                                            │
│  ┌─────────────────┬────────┴────────┬─────────────────┬─────────────┐ │
│  │                 │                 │                 │             │ │
│  ▼                 ▼                 ▼                 ▼             ▼ │
│ ┌─────┐  ┌──────┐  ┌─────┐  ┌──────┐  ┌───────────┐  ┌─────────┐   │ │
│ │Lead │  │User  │  │Auth │  │Tenant│  │  Business │  │  Kafka  │   │ │
│ │Mgmt │  │Mgmt  │  │ JWT │  │Multi │  │  Profile  │  │ Module  │   │ │
│ └──┬──┘  └──────┘  └─────┘  └──────┘  └───────────┘  └────┬────┘   │ │
│    │                                                         │         │ │
│    │ 1. Create Lead                          2. Publish     │         │ │
│    │    Save to DB                              Kafka Event │         │ │
│    │                                                         │         │ │
│    └─────────────────────────────────────────────────────────┘        │ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                             │  │
│  │  - Leads (with ai_insights)                                      │  │
│  │  - Messages                                                       │  │
│  │  - Users, Businesses, Tenants                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Redis Cache                                                     │  │
│  │  - Session management                                            │  │
│  │  - BullMQ queues                                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬───┬──────────────────────────────────────┘
                             │   │
                   Publish   │   │   Subscribe
                   Events    │   │   Results
                             ▼   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       APACHE KAFKA                                      │
│                       Port: 9092                                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Kafka Topics:                                                   │  │
│  │                                                                   │  │
│  │  📨 lead.created        - New lead notifications                │  │
│  │  📨 lead.updated        - Lead updates                          │  │
│  │  📨 lead.message        - New messages                          │  │
│  │  📨 ai.process.request  - Explicit AI processing                │  │
│  │  ✅ ai.process.result   - AI results                            │  │
│  │  ❌ ai.error            - AI errors                             │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Consumer Groups:                                                │  │
│  │  - biznavigate-backend-group  (Backend consumers)                │  │
│  │  - biznavigate-ai-group       (AI service consumers)             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Kafka UI (Port 8080)                                            │  │
│  │  - Topic management                                              │  │
│  │  - Message inspection                                            │  │
│  │  - Consumer monitoring                                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ Subscribe to Topics
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   BIZNAVIGATE AI (Python)                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Kafka Consumer (aiokafka)                                       │  │
│  │  - Listens to: lead.created, lead.message, ai.process.request   │  │
│  │  - Publishes: ai.process.result, ai.error                       │  │
│  └─────────────┬──────────────────────────────────────────────────┬─┘  │
│                │                                                   │    │
│                │ 3. Consume Event                                  │    │
│                │    Process with AI                                │    │
│                │                                                   │    │
│  ┌─────────────▼────────────┐  ┌──────────────────┐  ┌───────────▼──┐ │
│  │  Intent Detection        │  │  Entity          │  │  LLM         │ │
│  │  Service                 │  │  Extraction      │  │  Service     │ │
│  │  Port: 8001              │  │  Service         │  │  Port: 3000  │ │
│  │                          │  │  Port: 8002      │  │              │ │
│  │  - Rule-based (fast)     │  │                  │  │  - OpenAI    │ │
│  │  - ML Model (BERT)       │  │  - SpaCy NER     │  │  - Anthropic │ │
│  │  - LLM (fallback)        │  │  - Custom regex  │  │  - Claude    │ │
│  │                          │  │  - LLM enhance   │  │              │ │
│  │  Intents:                │  │                  │  │  Uses:       │ │
│  │  - ORDER_REQUEST         │  │  Extracts:       │  │  - Complex   │ │
│  │  - PRICING_INQUIRY       │  │  - Products      │  │    queries   │ │
│  │  - AVAILABILITY          │  │  - Quantities    │  │  - Response  │ │
│  │  - COMPLAINT             │  │  - Prices        │  │    gen       │ │
│  │  - SCHEDULE_CALL         │  │  - Emails        │  │  - Intent    │ │
│  │  - 20+ more...           │  │  - Phones        │  │    fallback  │ │
│  │                          │  │  - Dates         │  │              │ │
│  └──────────────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Redis Cache                                                     │  │
│  │  - Intent detection cache                                        │  │
│  │  - Entity extraction cache                                       │  │
│  │  - LLM response cache                                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ 4. Publish Result
                             │    to Kafka
                             ▼
         ┌────────────────────────────────────────┐
         │  Backend Kafka Consumer                 │
         │  - Receives ai.process.result           │
         │  - Updates lead in database             │
         │  - Stores AI insights                   │
         │  - Creates activity log                 │
         │  - Classifies lead priority             │
         └────────────────────────────────────────┘
```

## 🔄 Event Flow Sequence

### 1️⃣ Lead Creation Flow

```
Customer → WhatsApp Message
    ↓
Backend API: POST /api/v1/leads
    ↓
[Backend] Create lead in PostgreSQL
    ↓
[Backend] KafkaProducerService.publishLeadCreated()
    ↓
[Kafka] Message published to "lead.created" topic
    ↓
[AI Consumer] Receives event from Kafka
    ↓
[AI Consumer] Extracts lead text
    ↓
[AI Consumer] → HTTP POST → Intent Service (8001)
    ↓
[Intent Service] Detects intent: ORDER_REQUEST (confidence: 0.95)
    ↓
[AI Consumer] ← HTTP Response ← Intent Result
    ↓
[AI Consumer] → HTTP POST → Entity Service (8002)
    ↓
[Entity Service] Extracts: products, quantities, contact info
    ↓
[AI Consumer] ← HTTP Response ← Entity Result
    ↓
[AI Consumer] Combines results + generates suggested actions
    ↓
[AI Consumer] Publishes to "ai.process.result" topic
    ↓
[Kafka] Stores result message
    ↓
[Backend Consumer] Receives ai.process.result
    ↓
[Backend] Updates lead:
    - intent_type = "ORDER_REQUEST"
    - extracted_entities = {products, quantities, ...}
    - custom_fields.ai_confidence = 0.95
    - lead_quality = "hot" (based on intent)
    ↓
[Backend] Creates lead_activity record
    ↓
✅ Lead enriched with AI insights!
```

### 2️⃣ Message Processing Flow

```
Customer → New WhatsApp Message
    ↓
Backend Webhook Handler
    ↓
[Backend] Save message to lead_messages
    ↓
[Backend] KafkaProducerService.publishLeadMessage()
    ↓
[Kafka] "lead.message" topic
    ↓
[AI Consumer] Process with AI (same as above)
    ↓
[Backend] Update lead with new insights
    ↓
[Backend] Suggest response to agent
```

## 📈 Performance Characteristics

| Component | Latency | Throughput | Scalability |
|-----------|---------|------------|-------------|
| Backend API | 10-50ms | 1000 req/s | Horizontal |
| Kafka | <5ms | 1M msg/s | Horizontal |
| Intent Detection | 10-100ms | 100 req/s | Vertical |
| Entity Extraction | 50-200ms | 50 req/s | Vertical |
| LLM Service | 1-3s | 10 req/s | Cost-limited |
| End-to-End | 100-500ms | 50 leads/s | Both |

## 🔒 Data Flow Security

```
1. Backend → Kafka
   ✅ Internal network
   ✅ Optional SASL/SSL
   ✅ Event validation

2. Kafka → AI Consumer
   ✅ Consumer group isolation
   ✅ Message encryption (optional)
   ✅ Offset management

3. AI Services → APIs
   ✅ HTTP/HTTPS
   ✅ API key authentication
   ✅ Rate limiting

4. AI → Kafka → Backend
   ✅ Result validation
   ✅ Error handling
   ✅ Database transaction
```

## 💾 Data Storage

### PostgreSQL (Backend)
```sql
leads (
  lead_id,
  business_id,
  tenant_id,
  first_name,
  phone,
  email,
  intent_type,              -- ← From AI
  extracted_entities,       -- ← From AI (JSON)
  custom_fields,            -- ← AI confidence, tier, etc. (JSON)
  lead_quality,             -- ← Classified by AI
  ...
)

lead_activities (
  activity_id,
  lead_id,
  activity_type,            -- 'ai_processed', 'ai_error'
  metadata,                 -- AI results (JSON)
  ...
)
```

### Kafka (Message Broker)
```
Retention: 7 days
Partitions: 3 per topic
Replication: 1 (dev) / 3 (prod)
Compression: GZIP
```

### Redis (Cache)
```
TTL: 1 hour (AI results)
TTL: 24 hours (sessions)
```

## 🎯 Key Benefits

### For Development
- ✅ Easy testing with Kafka UI
- ✅ Message replay capability
- ✅ Independent service development
- ✅ Clear separation of concerns

### For Production
- ✅ High availability
- ✅ Fault tolerance
- ✅ Horizontal scaling
- ✅ Event audit trail
- ✅ Low latency
- ✅ High throughput

### For Business
- ✅ Real-time AI processing
- ✅ Automatic lead enrichment
- ✅ Better lead prioritization
- ✅ Faster response times
- ✅ Improved conversion rates

## 📊 Monitoring Points

```
Backend Metrics:
  - Events published/second
  - Event publish latency
  - Consumer lag
  - Error rate

Kafka Metrics:
  - Messages in/out per topic
  - Consumer group lag
  - Partition balance
  - Disk usage

AI Consumer Metrics:
  - Processing time per event
  - Success/failure rate
  - Intent distribution
  - Entity extraction rate

AI Services Metrics:
  - Request rate
  - Response time
  - Cache hit rate
  - LLM cost per business
```

## 🚀 Deployment Architecture

### Development
```
All services on localhost
- Docker Compose for Kafka
- npm run start:dev
- python main.py
```

### Production
```
Backend: Kubernetes/ECS
  - Multiple pods/containers
  - Auto-scaling
  - Load balancer

Kafka: Managed Service
  - AWS MSK
  - Confluent Cloud
  - Azure Event Hubs

AI Services: Kubernetes
  - GPU instances
  - Auto-scaling
  - Internal load balancer

Database: Managed PostgreSQL
  - Read replicas
  - Automated backups

Cache: Managed Redis
  - Cluster mode
  - High availability
```

---

**This architecture provides:**
- 🚀 Real-time AI processing
- 📈 Scalability to millions of leads
- 🔒 Security and reliability
- 📊 Complete observability
- 💰 Cost efficiency
