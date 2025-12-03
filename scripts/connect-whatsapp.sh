#!/bin/bash

# WhatsApp Account Connection Helper Script
# This script helps you connect your WhatsApp Business Account to BizNavigate

echo "🔐 WhatsApp Account Connection Helper"
echo "======================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:3006/api > /dev/null 2>&1; then
    echo "❌ Server is not running on port 3006"
    echo "Please start the server first: npm run start:dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Get inputs
echo "Please provide the following information:"
echo ""

read -p "1. WhatsApp Access Token (from Meta Developer Console): " ACCESS_TOKEN
if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Access token is required"
    exit 1
fi

read -p "2. Business ID (from your database): " BUSINESS_ID
if [ -z "$BUSINESS_ID" ]; then
    echo "❌ Business ID is required"
    exit 1
fi

read -p "3. JWT Token (optional - press Enter to skip): " JWT_TOKEN

# Use values from .env
WHATSAPP_BUSINESS_ACCOUNT_ID="4228932124046885"
PHONE_NUMBER_ID="962474686941832"

echo ""
echo "📋 Configuration:"
echo "   WhatsApp Business Account ID: $WHATSAPP_BUSINESS_ACCOUNT_ID"
echo "   Phone Number ID: $PHONE_NUMBER_ID"
echo "   Business ID: $BUSINESS_ID"
echo ""

# Prepare authorization header
AUTH_HEADER=""
if [ ! -z "$JWT_TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $JWT_TOKEN\""
fi

# Make API call
echo "🚀 Connecting WhatsApp account..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3006/api/whatsapp/accounts/connect \
  -H "Content-Type: application/json" \
  $(if [ ! -z "$JWT_TOKEN" ]; then echo "-H \"Authorization: Bearer $JWT_TOKEN\""; fi) \
  -d "{
    \"whatsappBusinessAccountId\": \"$WHATSAPP_BUSINESS_ACCOUNT_ID\",
    \"phoneNumberId\": \"$PHONE_NUMBER_ID\",
    \"accessToken\": \"$ACCESS_TOKEN\",
    \"businessId\": \"$BUSINESS_ID\"
  }")

# Check response
if echo "$RESPONSE" | grep -q "accountId"; then
    echo "✅ WhatsApp account connected successfully!"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "🎉 You can now receive and send WhatsApp messages!"
else
    echo "❌ Failed to connect WhatsApp account"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "Please check:"
    echo "  1. The access token is valid and not expired"
    echo "  2. The business ID exists in the database"
    echo "  3. The JWT token (if provided) is valid"
    exit 1
fi
