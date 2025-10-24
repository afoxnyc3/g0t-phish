#!/bin/bash

# Test g0t-phish webhook endpoint locally
# This simulates a Resend webhook POST

PORT=${1:-3001}
URL="http://localhost:$PORT/api/inbound"

echo "=================================================="
echo "🧪 Testing g0t-phish Webhook Endpoint"
echo "=================================================="
echo ""
echo "📍 URL: $URL"
echo "📧 Simulating phishing email from Resend..."
echo ""

# Send the webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d @test-payload.json)

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "📥 Response Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS! Webhook processed successfully"
  echo ""
  echo "📊 Response Body:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  echo ""
  echo "✉️  Check your email inbox for the analysis report!"
  echo "   (Sent to: test-user@gmail.com)"
elif [ "$HTTP_CODE" = "429" ]; then
  echo "⚠️  RATE LIMITED"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "400" ]; then
  echo "❌ BAD REQUEST - Invalid payload"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "500" ]; then
  echo "❌ SERVER ERROR"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  echo ""
  echo "💡 Check server logs for errors:"
  echo "   - Verify API keys are set correctly"
  echo "   - Check ANTHROPIC_API_KEY is valid"
  echo "   - Check UPSTASH_REDIS_REST_URL and TOKEN"
else
  echo "❓ UNEXPECTED STATUS: $HTTP_CODE"
  echo "$BODY"
fi

echo ""
echo "=================================================="
