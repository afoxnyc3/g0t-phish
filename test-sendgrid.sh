#!/bin/bash

# Test g0t-phish webhook with SendGrid format
# This simulates a SendGrid Inbound Parse webhook POST

PORT=${1:-3001}
URL="http://localhost:$PORT/api/inbound"

echo "=================================================="
echo "🧪 Testing g0t-phish with SendGrid Inbound Parse"
echo "=================================================="
echo ""
echo "📍 URL: $URL"
echo "📧 Simulating phishing email from SendGrid..."
echo ""

# Create headers string (SendGrid sends this as raw email headers)
HEADERS="Received: from mail-example.com (mail-example.com [192.0.2.1])
	by mx.sendgrid.net (Postfix) with ESMTPS id 12345
	for <alert@inbound.g0tphish.com>; Wed, 24 Oct 2025 03:00:00 +0000 (UTC)
From: urgent@paypa1-security.com
To: alert@inbound.g0tphish.com
Subject: Urgent: Your PayPal Account Has Been Limited
Date: Wed, 24 Oct 2025 03:00:00 GMT
Message-ID: <abc123@paypa1-security.com>"

# Create envelope JSON (SMTP envelope info)
ENVELOPE='{"to":["alert@inbound.g0tphish.com"],"from":"urgent@paypa1-security.com"}'

# Email body
TEXT_BODY="Dear PayPal User,

We have detected suspicious activity on your account and have temporarily limited access.

To restore full access, please verify your account immediately:

Click here to verify: http://paypa1-security.com/verify?token=abc123

If you do not verify within 24 hours, your account will be permanently suspended.

Thank you,
PayPal Security Team"

HTML_BODY="<html><body>
<p>Dear PayPal User,</p>
<p>We have detected suspicious activity on your account and have temporarily limited access.</p>
<p><strong>To restore full access, please verify your account immediately:</strong></p>
<p><a href=\"http://paypa1-security.com/verify?token=abc123\">Click here to verify</a></p>
<p>If you do not verify within 24 hours, your account will be permanently suspended.</p>
<p>Thank you,<br>PayPal Security Team</p>
</body></html>"

# Send the webhook using curl with multipart/form-data
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -F "headers=$HEADERS" \
  -F "dkim={@paypa1-security.com : fail}" \
  -F "to=alert@inbound.g0tphish.com" \
  -F "from=urgent@paypa1-security.com" \
  -F "subject=Urgent: Your PayPal Account Has Been Limited" \
  -F "text=$TEXT_BODY" \
  -F "html=$HTML_BODY" \
  -F "sender_ip=192.0.2.1" \
  -F "envelope=$ENVELOPE" \
  -F "attachments=0" \
  -F "SPF=fail" \
  -F "spam_score=5.2" \
  -F "spam_report=DKIM_INVALID, SPF_FAIL, SUSPICIOUS_URL")

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
  echo "   (Sent to: urgent@paypa1-security.com)"
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
