# Kafka Flow Test Script (PowerShell)
# Tests the complete event flow from backend -> Kafka -> AI services -> backend

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Kafka Integration Flow Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check Kafka is running
Write-Host "[1/7] Checking Kafka broker..." -ForegroundColor Yellow
$kafkaRunning = docker ps --filter "name=biznavigate-kafka" --format "{{.Names}}"
if ($kafkaRunning -like "*biznavigate-kafka*") {
    Write-Host "✓ Kafka broker is running" -ForegroundColor Green
} else {
    Write-Host "✗ Kafka broker is NOT running" -ForegroundColor Red
    Write-Host "Run: docker-compose -f docker-compose.kafka.simple.yml up -d" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Check Kafka topics
Write-Host "[2/7] Checking Kafka topics..." -ForegroundColor Yellow
docker exec biznavigate-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
Write-Host ""

# Test 3: Check backend Kafka health
Write-Host "[3/7] Testing backend Kafka connection..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3000/kafka/health" -Method Get -ErrorAction Stop
    Write-Host "✓ Backend connected to Kafka" -ForegroundColor Green
    Write-Host "Response: $($healthResponse | ConvertTo-Json)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Backend NOT connected to Kafka" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure backend is running: npm run start:dev" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Check Intent service
Write-Host "[4/7] Testing Intent service (port 8001)..." -ForegroundColor Yellow
try {
    $intentResponse = Invoke-RestMethod -Uri "http://localhost:8001/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Intent service is running" -ForegroundColor Green
} catch {
    Write-Host "⚠ Intent service not running (optional for basic flow)" -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Check Entity service
Write-Host "[5/7] Testing Entity service (port 8002)..." -ForegroundColor Yellow
try {
    $entityResponse = Invoke-RestMethod -Uri "http://localhost:8002/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Entity service is running" -ForegroundColor Green
} catch {
    Write-Host "⚠ Entity service not running (optional for basic flow)" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: Send test event to Kafka
Write-Host "[6/7] Publishing test event to Kafka..." -ForegroundColor Yellow
$testPayload = @{
    text = "I want to order 5 laptops urgently"
    lead_id = "test-lead-123"
    business_id = "test-biz-456"
} | ConvertTo-Json

try {
    $testResponse = Invoke-RestMethod -Uri "http://localhost:3000/kafka/test" -Method Post -Body $testPayload -ContentType "application/json" -ErrorAction Stop
    Write-Host "✓ Test event published to Kafka" -ForegroundColor Green
    Write-Host "Response: $($testResponse | ConvertTo-Json)" -ForegroundColor Gray
} catch {
    Write-Host "⚠ Test endpoint may not exist yet" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 7: Check consumer groups
Write-Host "[7/7] Checking Kafka consumer groups..." -ForegroundColor Yellow
docker exec biznavigate-kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Flow Test Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check backend logs for 'Published lead.created event'" -ForegroundColor White
Write-Host "2. Check AI consumer logs for 'Received event from lead.created'" -ForegroundColor White
Write-Host "3. Create a real lead via API to test full flow" -ForegroundColor White
Write-Host ""
