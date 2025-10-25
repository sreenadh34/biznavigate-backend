# Setup and Usage Guide - Kafka AI Integration

## 🚀 Quick Start

Follow these steps to get the Kafka-based AI integration running:

### 1. Install Dependencies

**Backend (NestJS):**
```powershell
cd biznavigate-backend
npm install kafkajs
```

**AI Services (Python):**
```powershell
cd ..\biznavigate_ai\services\kafka_consumer
pip install -r requirements.txt
```

### 2. Start Kafka Infrastructure

```powershell
cd ..\..\biznavigate-backend

# Start Kafka, Zookeeper, Kafka UI, and Redis
docker-compose -f docker-compose.kafka.yml up -d

# Check if services are running
docker-compose -f docker-compose.kafka.yml ps

# View logs
docker-compose -f docker-compose.kafka.yml logs -f
```

**Services Started:**
- Kafka: `localhost:9092`
- Zookeeper: `localhost:2181`
- Kafka UI: `http://localhost:8080`
- Redis: `localhost:6379`

### 3. Configure Environment Variables

**Backend `.env`:**
```env
# Add these to your existing .env file
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=biznavigate-backend
KAFKA_GROUP_ID=biznavigate-backend-group
```

**AI Services `.env`:**
```powershell
cd ..\biznavigate_ai\services\kafka_consumer
cp .env.example .env

# Edit .env if needed (default values should work)
```

### 4. Start All Services

**Terminal 1 - Backend (NestJS):**
```powershell
cd biznavigate-backend
npm run start:dev
```

**Terminal 2 - Intent Service:**
```powershell
cd ..\biznavigate_ai\services\intent-service
python run_single_worker.py
```

**Terminal 3 - Entity Service:**
```powershell
cd ..\biznavigate_ai\services\entity-service
python main.py
```

**Terminal 4 - LLM Service (Optional):**
```powershell
cd ..\biznavigate_ai\services\llm-service
python main.py
```

**Terminal 5 - Kafka AI Consumer:**
```powershell
cd ..\biznavigate_ai\services\kafka_consumer
python main.py
```

### 5. Verify Setup

**Check Kafka Health:**
```powershell
curl http://localhost:3000/kafka/health
```

**Check Kafka UI:**
Open browser: `http://localhost:8080`
- View topics
- Monitor messages
- Check consumer groups

### 6. Test the Integration

**Send a test event:**
```powershell
curl -X POST http://localhost:3000/kafka/test -H "Content-Type: application/json" -d '{\"text\": \"I want to order 2 laptops\", \"lead_id\": \"test-123\", \"business_id\": \"biz-456\"}'
```

**Create a lead (triggers AI processing):**
```powershell
# You'll need a valid JWT token
curl -X POST http://localhost:3000/api/v1/leads -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{
  \"first_name\": \"John\",
  \"phone\": \"+919876543210\",
  \"source\": \"whatsapp\",
  \"initial_message\": \"I want to buy 2 iPhones\",
  \"business_id\": \"your-business-id\",
  \"tenant_id\": \"your-tenant-id\"
}'
```

## 📊 Monitoring

### Kafka UI Dashboard
- URL: `http://localhost:8080`
- View all topics and messages
- Monitor consumer lag
- Inspect message content

### Backend Logs
```powershell
# Watch for Kafka events
npm run start:dev
# Look for: "Published lead.created event"
```

### AI Consumer Logs
```powershell
cd biznavigate_ai\services\kafka_consumer
python main.py
# Look for: "Received event: lead.created"
```

## 🔧 Troubleshooting

### Kafka Connection Issues

**Problem:** `Connection refused to localhost:9092`

**Solution:**
```powershell
# Check if Kafka is running
docker-compose -f docker-compose.kafka.yml ps

# Restart Kafka
docker-compose -f docker-compose.kafka.yml restart kafka

# Check logs
docker-compose -f docker-compose.kafka.yml logs kafka
```

### Consumer Not Receiving Messages

**Problem:** AI consumer not processing events

**Solution:**
```powershell
# Check consumer group status in Kafka UI
# http://localhost:8080 -> Consumers

# Reset consumer group offset
docker exec -it biznavigate-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group biznavigate-ai-group --reset-offsets --to-earliest --all-topics --execute
```

### AI Services Not Responding

**Problem:** HTTP errors when calling AI services

**Solution:**
```powershell
# Check if AI services are running
# Intent Service
curl http://localhost:8001/health

# Entity Service
curl http://localhost:8002/health

# Restart services if needed
```

### Port Already in Use

**Problem:** `Port 9092 is already allocated`

**Solution:**
```powershell
# Stop all containers
docker-compose -f docker-compose.kafka.yml down

# Remove volumes
docker-compose -f docker-compose.kafka.yml down -v

# Start again
docker-compose -f docker-compose.kafka.yml up -d
```

## 🎯 How It Works

### Event Flow

1. **Lead Created** in Backend
   ```
   POST /api/v1/leads
   ↓
   Lead saved to database
   ↓
   KafkaProducerService.publishLeadCreated()
   ↓
   Event published to 'lead.created' topic
   ```

2. **AI Processing**
   ```
   Kafka Consumer receives event
   ↓
   Extracts lead text
   ↓
   Calls Intent Service (http://localhost:8001)
   ↓
   Calls Entity Service (http://localhost:8002)
   ↓
   Combines results
   ↓
   Publishes to 'ai.process.result' topic
   ```

3. **Result Processed**
   ```
   Backend consumer receives result
   ↓
   KafkaConsumerService.handleAiProcessResult()
   ↓
   Updates lead in database
   ↓
   Creates activity log
   ```

## 📈 Performance Tips

1. **Increase Kafka Partitions** for higher throughput:
   ```powershell
   docker exec -it biznavigate-kafka kafka-topics --bootstrap-server localhost:9092 --alter --topic lead.created --partitions 6
   ```

2. **Scale Consumers** - Run multiple instances:
   ```powershell
   # Terminal 1
   python main.py

   # Terminal 2 (different consumer in same group)
   python main.py
   ```

3. **Enable Compression**:
   - Kafka already configured with compression
   - Reduces network bandwidth

## 🛑 Stopping Services

```powershell
# Stop backend
# Ctrl+C in backend terminal

# Stop AI services
# Ctrl+C in each AI service terminal

# Stop Kafka infrastructure
docker-compose -f docker-compose.kafka.yml down

# Remove all data (careful!)
docker-compose -f docker-compose.kafka.yml down -v
```

## 📚 Next Steps

1. **Add Authentication** to Kafka (SASL/SSL)
2. **Implement Dead Letter Queue** for failed messages
3. **Add Retry Logic** with exponential backoff
4. **Set up Monitoring** (Prometheus + Grafana)
5. **Configure Alerts** for consumer lag
6. **Implement Schema Registry** for message validation

## 🔗 Useful Commands

```powershell
# List all topics
docker exec -it biznavigate-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Describe a topic
docker exec -it biznavigate-kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic lead.created

# View messages in a topic
docker exec -it biznavigate-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic lead.created --from-beginning

# Check consumer group lag
docker exec -it biznavigate-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --group biznavigate-ai-group --describe
```
