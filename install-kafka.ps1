# Install KafkaJS for NestJS Backend
Write-Host "Installing KafkaJS..." -ForegroundColor Green
npm install kafkajs

Write-Host "`n✅ KafkaJS installed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Start Kafka: docker-compose -f docker-compose.kafka.yml up -d" -ForegroundColor Cyan
Write-Host "2. Configure .env file with KAFKA_BROKERS=localhost:9092" -ForegroundColor Cyan
Write-Host "3. Start backend: npm run start:dev" -ForegroundColor Cyan
Write-Host "`nFor full setup guide, see: README_KAFKA_INTEGRATION.md" -ForegroundColor Yellow
