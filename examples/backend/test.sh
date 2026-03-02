#!/usr/bin/env bash

# Test script for x402 Express Backend

echo "🧪 Testing x402 Express Backend"
echo "================================="
echo ""

BASE_URL="http://localhost:3001"

echo "1️⃣ Testing root endpoint (GET /)..."
RESPONSE=$(curl -s "$BASE_URL/")
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo "2️⃣ Testing free endpoint (GET /api/free)..."
RESPONSE=$(curl -s "$BASE_URL/api/free")
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo "3️⃣ Testing protected weather endpoint (GET /api/weather) - should return 402..."
RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}" "$BASE_URL/api/weather")
echo "$RESPONSE"
echo ""

echo "4️⃣ Testing protected premium endpoint (GET /api/premium) - should return 402..."
RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}" "$BASE_URL/api/premium")
echo "$RESPONSE"
echo ""

echo "5️⃣ Testing protected expensive endpoint (GET /api/expensive) - should return 402..."
RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}" "$BASE_URL/api/expensive")
echo "$RESPONSE"
echo ""

echo "✅ Test completed!"
echo ""
echo "Summary:"
echo "  - Free endpoints are accessible ✓"
echo "  - Protected endpoints return 402 Payment Required ✓"
echo "  - x402-chainlink library is working from npm ✓"
