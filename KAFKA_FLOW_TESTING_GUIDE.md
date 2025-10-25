# Kafka Event Flow Testing Guide

This guide will help you verify that the complete Kafka event flow is working correctly.

## 🎯 Complete Event Flow

```
User Action (Create Lead)
    ↓
Backend API (/leads endpoint)
    ↓
Database: Insert lead record
    ↓
Kafka Producer: Publish to "lead.created" topic
    ↓
Kafka Broker: Route message
    ↓
AI Consumer: Receive event
    ↓
AI Services: Process (Intent + Entity)
    ↓
Kafka Producer: Publish to "ai.process.result" topic
    ↓
Backend Consumer: Receive AI results
    ↓
Database: Update lead with AI insights
    ↓
Lead now has: intent_type, entities, confidence, quality
```

---

## ✅ Pre-requisites Checklist

Before testing, ensure all services are running:

- [ ] **Kafka & Zookeeper** (Docker)
  ```bash
  docker ps | findstr biznavigate
  # Should show both kafka and zookeeper as "healthy"
  ```

- [ ] **Backend Server** (Terminal 1)
  ```bash
  cd d:\personalP\biznav\biznavigate-backend
  npm run start:dev
  # Wait for: "Nest application successfully started"
  ```

- [ ] **AI Kafka Consumer** (Terminal 2)
  ```bash
  cd d:\personalP\biznav\biznavigate_ai\services\kafka_consumer
  python main.py
  # Wait for: "AI Kafka Consumer started. Waiting for events..."
  ```

- [ ] **Intent Service** (Terminal 3) - OPTIONAL
  ```bash
  cd d:\personalP\biznav\biznavigate_ai
  python -m src.services.intent.app.main
  # Wait for: "Uvicorn running on http://0.0.0.0:8001"
  ```

- [ ] **Entity Service** (Terminal 4) - OPTIONAL
  ```bash
  cd d:\personalP\biznav\biznavigate_ai
  python -m src.services.entity.app.main
  # Wait for: "Uvicorn running on http://0.0.0.0:8002"
  ```

---

## 🧪 Automated Test (Quick Check)

Run the PowerShell test script:

```powershell
cd d:\personalP\biznav\biznavigate-backend
.\test-kafka-flow.ps1
```

This will check:
- ✅ Kafka broker status
- ✅ Kafka topics created
- ✅ Backend Kafka connection
- ✅ AI services availability
- ✅ Consumer groups registered

---

## 🔍 Manual Testing (Step-by-Step)

### Test 1: Verify Kafka Infrastructure

**Check Kafka Topics:**
```bash
docker exec biznavigate-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**Expected Output:**
```
ai.error
ai.process.request
ai.process.result
lead.created
lead.message
lead.updated
```

**Check Consumer Groups:**
```bash
docker exec biznavigate-kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
```

**Expected Output:**
```
biznavigate-backend-group
biznavigate-ai-group
```

---

### Test 2: Backend Kafka Health Check

```bash
curl http://localhost:3000/kafka/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "kafka",
  "timestamp": "2025-10-25T12:00:00.000Z"
}
```

---

### Test 3: Monitor Kafka Topics in Real-Time

Open a **new terminal** and start monitoring the `lead.created` topic:

```bash
docker exec biznavigate-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic lead.created \
  --from-beginning
```

Keep this terminal open to see events as they arrive.

---

### Test 4: Create a Test Lead

**Option A: Using curl**

```bash
curl -X POST http://localhost:3000/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: adj@123" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "email": "john.doe@example.com",
    "source": "website",
    "business_id": "test-business-id",
    "tenant_id": "test-tenant-id",
    "initial_message": "I want to order 10 laptops urgently for my office"
  }'
```

**Option B: Using PowerShell**

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "adj@123"
}

$body = @{
    first_name = "Jane"
    last_name = "Smith"
    phone = "+1987654321"
    email = "jane@example.com"
    source = "whatsapp"
    business_id = "test-business-id"
    tenant_id = "test-tenant-id"
    initial_message = "Need pricing for bulk order of 50 chairs"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/leads" -Method Post -Headers $headers -Body $body
```

---

### Test 5: Verify Event Flow Through Logs

Watch the logs in each terminal window:

**Terminal 1 (Backend) - Look for:**
```
[Nest] LOG [KafkaProducerService] Published lead.created event for lead: <lead_id>
```

**Terminal 2 (AI Consumer) - Look for:**
```
INFO - Received event from lead.created: {'lead_id': '...', ...}
INFO - Processing lead with AI services...
INFO - AI processing completed for lead: <lead_id>
INFO - Published result to ai.process.result topic
```

**Terminal 3 & 4 (Intent/Entity Services) - Look for:**
```
INFO: 127.0.0.1:xxxxx - "POST /detect HTTP/1.1" 200 OK
```

**Terminal 1 (Backend) - Look for AI result received:**
```
[Nest] LOG [KafkaConsumerService] Received AI processing result for lead: <lead_id>
[Nest] LOG [KafkaConsumerService] Updated lead with intent: ORDER_REQUEST, confidence: 0.95
```

---

### Test 6: Verify Database Update

Query the database to see if the lead was updated with AI insights:

```sql
SELECT
    lead_id,
    first_name,
    last_name,
    intent_type,
    ai_confidence,
    lead_quality,
    custom_fields->>'extracted_entities' as entities
FROM leads
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `intent_type`: "ORDER_REQUEST"
- `ai_confidence`: 0.85 - 0.95
- `lead_quality`: "hot" or "warm"
- `entities`: JSON with extracted information

---

### Test 7: Check Lead Activities Log

Verify the AI processing was logged:

```sql
SELECT
    activity_type,
    description,
    created_at
FROM lead_activities
WHERE lead_id = '<your-lead-id>'
ORDER BY created_at DESC;
```

**Expected Entry:**
```
activity_type: ai_processing
description: AI analysis completed - Intent: ORDER_REQUEST (95.00% confidence)
```

---

## 🐛 Troubleshooting Guide

### Issue 1: Kafka Topics Not Created

**Symptom:** `kafka-topics.sh --list` shows no topics

**Solution:**
```bash
# Check Kafka logs
docker logs biznavigate-kafka

# Manually create topics
docker exec biznavigate-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create \
  --topic lead.created \
  --partitions 3 \
  --replication-factor 1
```

---

### Issue 2: Backend Not Connecting to Kafka

**Symptom:** Backend logs show "KafkaConnectionError"

**Check:**
1. Verify Kafka is running: `docker ps | findstr kafka`
2. Check .env file: `KAFKA_BROKERS=localhost:9092`
3. Restart backend after Kafka is running

**Fix:**
```bash
# Restart Kafka
docker-compose -f docker-compose.kafka.simple.yml restart

# Wait 10 seconds, then restart backend
# Press Ctrl+C in backend terminal, then npm run start:dev
```

---

### Issue 3: AI Consumer Can't Connect

**Symptom:** "No connection to node with id..."

**Check:**
```bash
# Verify advertised listeners
docker exec biznavigate-kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

Should show: `localhost:9092 (id: <some-id>)`

**Fix:**
- Check [.env](d:\personalP\biznav\biznavigate_ai\services\kafka_consumer\.env) has `KAFKA_BROKERS=localhost:9092`
- Not `localhost:9093` or `kafka:9092`

---

### Issue 4: No Events Received by Consumer

**Symptom:** Backend publishes but AI consumer shows no activity

**Debug:**
```bash
# Check consumer group lag
docker exec biznavigate-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group biznavigate-ai-group \
  --describe
```

**Check for:**
- LAG column should decrease when events are processed
- CURRENT-OFFSET should be increasing

**Fix:**
```bash
# Reset consumer group (WARNING: reprocesses all messages)
docker exec biznavigate-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group biznavigate-ai-group \
  --reset-offsets \
  --to-earliest \
  --all-topics \
  --execute
```

---

### Issue 5: AI Services Not Processing

**Symptom:** Consumer receives events but no AI processing happens

**Check:**
1. Intent service running on port 8001
2. Entity service running on port 8002
3. Check consumer logs for HTTP errors

**Test AI Services Directly:**
```bash
# Test Intent Service
curl -X POST http://localhost:8001/detect \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to order laptops", "business_type": "retail"}'

# Test Entity Service
curl -X POST http://localhost:8002/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Order 10 laptops for $500", "business_type": "retail"}'
```

---

## 📊 Monitoring Commands

### Real-time Topic Monitoring

**Monitor lead.created:**
```bash
docker exec biznavigate-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic lead.created \
  --from-beginning
```

**Monitor ai.process.result:**
```bash
docker exec biznavigate-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ai.process.result \
  --from-beginning
```

**Monitor ai.error:**
```bash
docker exec biznavigate-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ai.error \
  --from-beginning
```

---

### Consumer Group Monitoring

```bash
# List all consumer groups
docker exec biznavigate-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --list

# Check backend consumer group
docker exec biznavigate-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group biznavigate-backend-group \
  --describe

# Check AI consumer group
docker exec biznavigate-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group biznavigate-ai-group \
  --describe
```

---

## ✅ Success Criteria

Your Kafka integration is working correctly if:

1. ✅ All 6 Kafka topics exist (`lead.created`, `lead.updated`, `lead.message`, `ai.process.request`, `ai.process.result`, `ai.error`)
2. ✅ Both consumer groups are registered and active
3. ✅ Backend `/kafka/health` returns `{"status": "healthy"}`
4. ✅ Creating a lead triggers:
   - Event published to `lead.created` topic
   - AI consumer receives and processes event
   - Result published to `ai.process.result` topic
   - Backend receives result and updates database
5. ✅ Lead in database has populated fields:
   - `intent_type`
   - `ai_confidence`
   - `lead_quality`
   - `custom_fields.extracted_entities`
6. ✅ Lead activities table has AI processing log entry

---

## 🎉 Next Steps

Once the flow is working:

1. **Production Hardening:**
   - Add message schema validation
   - Implement dead letter queue for failed messages
   - Add retry logic with exponential backoff
   - Enable SASL/SSL security

2. **Monitoring:**
   - Set up consumer lag alerts
   - Add distributed tracing (OpenTelemetry)
   - Implement Prometheus metrics

3. **Scaling:**
   - Add more Kafka brokers (minimum 3)
   - Increase partition count for high-volume topics
   - Add more AI consumer instances

---

## 📚 Additional Resources

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Backend Kafka Module](./src/features/kafka/)
- [AI Consumer Source](../biznavigate_ai/services/kafka_consumer/main.py)
- [Integration Guide](./README_KAFKA_INTEGRATION.md)
- [Setup Guide](./SETUP_KAFKA.md)

---

**Created:** 2025-10-25
**Author:** Claude Code AI Assistant
