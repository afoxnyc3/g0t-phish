#!/bin/bash

# Test g0t-phish webhook with SendGrid format - SAFE EMAIL
# This simulates a legitimate email from SendGrid Inbound Parse

PORT=${1:-3001}
URL="http://localhost:$PORT/api/inbound"

echo "=================================================="
echo "🧪 Testing g0t-phish with SendGrid - SAFE EMAIL"
echo "=================================================="
echo ""
echo "📍 URL: $URL"
echo "📧 Simulating legitimate email from SendGrid..."
echo ""

# Create headers string
HEADERS="Received: from mail.example.com (mail.example.com [192.0.2.100])
	by mx.sendgrid.net (Postfix) with ESMTPS id 67890
	for <alert@inbound.g0tphish.com>; Wed, 24 Oct 2025 03:05:00 +0000 (UTC)
From: john@example.com
To: alert@inbound.g0tphish.com
Subject: Can you check this suspicious email for me?
Date: Wed, 24 Oct 2025 03:05:00 GMT
Message-ID: <xyz789@example.com>"

# Create envelope JSON
ENVELOPE='{"to":["alert@inbound.g0tphish.com"],"from":"john@example.com"}'

# Email body
TEXT_BODY="Hi,

I received this email and I'm not sure if it's legitimate. Can you analyze it for me?

Thanks for your help!

Best regards,
John"

HTML_BODY="<html><body>
<p>Hi,</p>
<p>I received this email and I'm not sure if it's legitimate. Can you analyze it for me?</p>
<p>Thanks for your help!</p>
<p>Best regards,<br>John</p>
</body></html>"

# Send the webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -F "headers=$HEADERS" \
  -F "dkim={@example.com : pass}" \
  -F "to=alert@inbound.g0tphish.com" \
  -F "from=john@example.com" \
  -F "subject=Can you check this suspicious email for me?" \
  -F "text=$TEXT_BODY" \
  -F "html=$HTML_BODY" \
  -F "sender_ip=192.0.2.100" \
  -F "envelope=$ENVELOPE" \
  -F "attachments=0" \
  -F "SPF=pass" \
  -F "spam_score=0.1" \
  -F "spam_report=NONE")

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
  echo "   (Sent to: john@example.com)"
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
  echo "💡 Check server logs for errors"
else
  echo "❓ UNEXPECTED STATUS: $HTTP_CODE"
  echo "$BODY"
fi

echo ""
echo "=================================================="
