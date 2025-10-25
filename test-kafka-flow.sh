#!/bin/bash
# Kafka Flow Test Script
# Tests the complete event flow from backend -> Kafka -> AI services -> backend

echo "=========================================="
echo "Kafka Integration Flow Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Kafka is running
echo -e "${YELLOW}[1/7] Checking Kafka broker...${NC}"
if docker ps | grep -q "biznavigate-kafka"; then
    echo -e "${GREEN}✓ Kafka broker is running${NC}"
else
    echo -e "${RED}✗ Kafka broker is NOT running${NC}"
    exit 1
fi
echo ""

# Test 2: Check Kafka topics
echo -e "${YELLOW}[2/7] Checking Kafka topics...${NC}"
docker exec biznavigate-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
echo ""

# Test 3: Check backend Kafka health
echo -e "${YELLOW}[3/7] Testing backend Kafka connection...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/kafka/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Backend connected to Kafka${NC}"
    echo "Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Backend NOT connected to Kafka${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 4: Check Intent service
echo -e "${YELLOW}[4/7] Testing Intent service (port 8001)...${NC}"
INTENT_RESPONSE=$(curl -s http://localhost:8001/health 2>&1)
if [ $? -eq 0 ] && [ ! -z "$INTENT_RESPONSE" ]; then
    echo -e "${GREEN}✓ Intent service is running${NC}"
else
    echo -e "${YELLOW}⚠ Intent service not running (optional for basic flow)${NC}"
fi
echo ""

# Test 5: Check Entity service
echo -e "${YELLOW}[5/7] Testing Entity service (port 8002)...${NC}"
ENTITY_RESPONSE=$(curl -s http://localhost:8002/health 2>&1)
if [ $? -eq 0 ] && [ ! -z "$ENTITY_RESPONSE" ]; then
    echo -e "${GREEN}✓ Entity service is running${NC}"
else
    echo -e "${YELLOW}⚠ Entity service not running (optional for basic flow)${NC}"
fi
echo ""

# Test 6: Send test event to Kafka
echo -e "${YELLOW}[6/7] Publishing test event to Kafka...${NC}"
TEST_RESPONSE=$(curl -s -X POST http://localhost:3000/kafka/test \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to order 5 laptops urgently",
    "lead_id": "test-lead-123",
    "business_id": "test-biz-456"
  }')

if echo "$TEST_RESPONSE" | grep -q "published\|success\|sent"; then
    echo -e "${GREEN}✓ Test event published to Kafka${NC}"
    echo "Response: $TEST_RESPONSE"
else
    echo -e "${YELLOW}⚠ Test endpoint may not exist yet${NC}"
    echo "Response: $TEST_RESPONSE"
fi
echo ""

# Test 7: Check consumer group
echo -e "${YELLOW}[7/7] Checking Kafka consumer groups...${NC}"
docker exec biznavigate-kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
echo ""

echo "=========================================="
echo -e "${GREEN}Flow Test Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check backend logs for 'Published lead.created event'"
echo "2. Check AI consumer logs for 'Received event from lead.created'"
echo "3. Create a real lead via API to test full flow"
echo ""
