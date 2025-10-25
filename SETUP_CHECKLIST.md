# 🚀 Kafka AI Integration - Setup Checklist

Use this checklist to set up the Kafka-based AI integration step by step.

## ✅ Pre-requisites

- [ ] Node.js 18+ installed
- [ ] Python 3.10+ installed
- [ ] Docker Desktop installed and running
- [ ] PostgreSQL running
- [ ] Git repository cloned

## 📦 Step 1: Install Dependencies (5 minutes)

### Backend Dependencies

```powershell
cd biznavigate-backend
npm install kafkajs
```

**Expected output:** `added 1 package`

### AI Service Dependencies

```powershell
cd ..\biznavigate_ai\services\kafka_consumer
pip install -r requirements.txt
```

**Expected output:** `Successfully installed aiokafka-0.10.0 httpx-0.25.2 aiohttp-3.9.1`

## 🐳 Step 2: Start Kafka Infrastructure (2 minutes)

```powershell
cd ..\..\biznavigate-backend
docker-compose -f docker-compose.kafka.yml up -d
```

**Wait for services to start (~30 seconds)**

### Verify Services

```powershell
docker-compose -f docker-compose.kafka.yml ps
```

**Expected:** All services should show "Up" status

- [ ] zookeeper - Up
- [ ] kafka - Up (healthy)
- [ ] kafka-ui - Up
- [ ] redis - Up

### Test Kafka UI

Open browser: `http://localhost:8080`

- [ ] Can access Kafka UI
- [ ] See "biznavigate" cluster
- [ ] Topics list is visible

## ⚙️ Step 3: Configure Environment (3 minutes)

### Backend Configuration

Edit `biznavigate-backend/.env`, add:

```env
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-backend
KAFKA_GROUP_ID=biznavigate-backend-group
```

- [ ] KAFKA_BROKERS added
- [ ] KAFKA_CLIENT_ID added
- [ ] KAFKA_GROUP_ID added

### AI Services Configuration

```powershell
cd ..\biznavigate_ai\services\kafka_consumer
copy .env.example .env
```

Edit `.env` if needed (defaults should work):

```env
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=biznavigate-ai-group
INTENT_SERVICE_URL=http://localhost:8001
ENTITY_SERVICE_URL=http://localhost:8002
LLM_SERVICE_URL=http://localhost:3000
```

- [ ] .env file created
- [ ] Configuration reviewed

## 🏃 Step 4: Start Services (5 minutes)

You'll need **5 terminal windows**. Open them now.

### Terminal 1: Backend

```powershell
cd biznavigate-backend
npm run start:dev
```

**Wait for:** `Application is running on: http://localhost:3000`

- [ ] Backend started
- [ ] No errors in console
- [ ] Port 3000 is listening

### Terminal 2: Intent Service

```powershell
cd biznavigate_ai\services\intent-service
python run_single_worker.py
```

**Wait for:** `Intent Detection Service started on port 8001`

- [ ] Intent service started
- [ ] Port 8001 is listening

### Terminal 3: Entity Service

```powershell
cd biznavigate_ai\services\entity-service
python main.py
```

**Wait for:** `Entity Extraction Service started on port 8002`

- [ ] Entity service started
- [ ] Port 8002 is listening

### Terminal 4: LLM Service (Optional)

```powershell
cd biznavigate_ai\services\llm-service
python main.py
```

**Wait for:** `LLM Service started on port 3000`

- [ ] LLM service started (optional)
- [ ] Port 3000 is listening (or skip if not needed)

### Terminal 5: Kafka AI Consumer

```powershell
cd biznavigate_ai\services\kafka_consumer
python main.py
```

**Wait for:** `Kafka consumer started. Connected to: ['localhost:9092']`

- [ ] Kafka consumer started
- [ ] Connected to Kafka
- [ ] Subscribed to topics

## ✅ Step 5: Verify Integration (5 minutes)

### Test 1: Kafka Health Check

```powershell
curl http://localhost:3000/kafka/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "kafka",
  "timestamp": "..."
}
```

- [ ] Kafka health check passes
- [ ] Status is "healthy"

### Test 2: Send Test Event

```powershell
curl -X POST http://localhost:3000/kafka/test -H "Content-Type: application/json" -d "{\"text\":\"I want to buy 2 laptops\",\"lead_id\":\"test-123\",\"business_id\":\"biz-456\"}"
```

**Expected response:**
```json
{
  "message": "Test event published to Kafka",
  "timestamp": "..."
}
```

- [ ] Test event sent successfully
- [ ] Check Terminal 5 for "Received event: ai.process.request"
- [ ] Check Terminal 5 for "AI processing completed"

### Test 3: Check Kafka UI

Open: `http://localhost:8080`

Navigate to: Topics → ai.process.request → Messages

- [ ] Can see test message in topic
- [ ] Message content is visible
- [ ] Consumer group is active

### Test 4: AI Services Health

```powershell
# Intent Service
curl http://localhost:8001/health

# Entity Service
curl http://localhost:8002/health
```

- [ ] Intent service health check passes
- [ ] Entity service health check passes

## 🎯 Step 6: Test with Real Lead (Optional)

If you have authentication set up:

```powershell
curl -X POST http://localhost:3000/api/v1/leads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"first_name\":\"John\",
    \"phone\":\"+919876543210\",
    \"source\":\"whatsapp\",
    \"initial_message\":\"I want to order 5 laptops\",
    \"business_id\":\"your-business-id\",
    \"tenant_id\":\"your-tenant-id\"
  }"
```

**Check Terminal 5 for:**
- "Received event: lead.created"
- "Processing new lead ... with AI"
- "AI processing completed"

- [ ] Lead created successfully
- [ ] Kafka event published
- [ ] AI processing triggered
- [ ] Result received in backend

## 📊 Step 7: Monitor (Ongoing)

### Kafka UI Monitoring

Open: `http://localhost:8080`

Check:
- [ ] All topics created (lead.created, lead.message, ai.process.result, etc.)
- [ ] Consumer groups active
- [ ] No consumer lag

### Service Logs

Watch each terminal for:

**Terminal 1 (Backend):**
- "Published lead.created event"
- "Processing AI result for lead"

**Terminal 5 (AI Consumer):**
- "Received event"
- "AI processing completed"
- No errors

## 🔧 Troubleshooting Checklist

### If Kafka won't start:

- [ ] Docker Desktop is running
- [ ] Port 9092 is not in use
- [ ] Run: `docker-compose -f docker-compose.kafka.yml down -v`
- [ ] Run: `docker-compose -f docker-compose.kafka.yml up -d`

### If Consumer not receiving messages:

- [ ] Kafka consumer is running (Terminal 5)
- [ ] Check consumer group in Kafka UI
- [ ] Verify topics exist in Kafka UI
- [ ] Check for errors in Terminal 5

### If AI services not responding:

- [ ] Intent service running (Terminal 2)
- [ ] Entity service running (Terminal 3)
- [ ] Check health endpoints
- [ ] Verify ports not in use

### If Backend errors:

- [ ] .env has Kafka configuration
- [ ] KafkaModule imported in app.module.ts
- [ ] No TypeScript errors
- [ ] Run: `npm install kafkajs`

## 🎉 Success Criteria

Your integration is working correctly if:

- [x] All 5 services running without errors
- [x] Kafka health check passes
- [x] Test event processes successfully
- [x] Can see messages in Kafka UI
- [x] AI consumer receives and processes events
- [x] Backend receives AI results
- [x] Lead is updated with AI insights

## 📚 Next Steps

Once everything is working:

1. **Read Documentation:**
   - [ ] Review `README_KAFKA_INTEGRATION.md`
   - [ ] Study `KAFKA_AI_INTEGRATION.md`
   - [ ] Check `lead-kafka-integration.example.ts`

2. **Integrate with Your Code:**
   - [ ] Add KafkaProducerService to LeadService
   - [ ] Publish events on lead creation
   - [ ] Publish events on new messages
   - [ ] Handle AI results in your business logic

3. **Production Preparation:**
   - [ ] Plan managed Kafka deployment
   - [ ] Set up monitoring alerts
   - [ ] Configure proper retention
   - [ ] Enable authentication/SSL

## ✅ Final Checklist

- [ ] All dependencies installed
- [ ] Kafka infrastructure running
- [ ] All services started
- [ ] Health checks passing
- [ ] Test event processed
- [ ] Kafka UI accessible
- [ ] Documentation reviewed
- [ ] Ready for production integration

---

## 🆘 Getting Help

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting-checklist)
2. Review service logs in each terminal
3. Check Kafka UI for message flow
4. Verify all ports are available
5. Restart services in order

## 📞 Support Resources

- **Setup Guide:** `SETUP_KAFKA.md`
- **Complete Guide:** `README_KAFKA_INTEGRATION.md`
- **Architecture:** `KAFKA_AI_INTEGRATION.md`
- **Code Examples:** `lead-kafka-integration.example.ts`

---

**Time to Complete:** ~20 minutes
**Last Updated:** October 25, 2025
