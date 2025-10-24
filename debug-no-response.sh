#!/bin/bash

# g0t-phish Debug Script - No Response Troubleshooting
# Run: bash debug-no-response.sh

echo "🔍 g0t-phish Debug - No Response Troubleshooting"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get deployment URL
echo "📍 Step 1: Finding your deployment URL..."
echo ""

if command -v vercel &> /dev/null; then
    DEPLOY_URL=$(vercel ls g0t-phish 2>/dev/null | grep "Production" | awk '{print $2}' | head -1)
    if [ -n "$DEPLOY_URL" ]; then
        echo -e "${GREEN}✓${NC} Found deployment: ${BLUE}https://${DEPLOY_URL}${NC}"
    else
        echo -e "${YELLOW}!${NC} Could not find deployment URL automatically"
        echo "  Please enter your Vercel URL (e.g., g0t-phish.vercel.app):"
        read -r DEPLOY_URL
    fi
else
    echo -e "${YELLOW}!${NC} Vercel CLI not installed"
    echo "  Please enter your Vercel URL (e.g., g0t-phish.vercel.app):"
    read -r DEPLOY_URL
fi

echo ""

# Test 1: Health Check
echo "🏥 Step 2: Testing health endpoint..."
echo ""

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "https://${DEPLOY_URL}/api/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Health check passed!"
    echo "  Response: $BODY"
else
    echo -e "${RED}✗${NC} Health check failed (HTTP $HTTP_CODE)"
    echo "  This means your deployment might not be working"
    echo "  Check Vercel dashboard: https://vercel.com/dashboard"
    exit 1
fi

echo ""

# Test 2: Webhook Endpoint
echo "📧 Step 3: Testing webhook endpoint..."
echo ""

WEBHOOK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://${DEPLOY_URL}/api/inbound" \
  -F "from=debug@example.com" \
  -F "to=alert@test.com" \
  -F "subject=Debug Test" \
  -F "text=This is a debug test" 2>&1)

HTTP_CODE=$(echo "$WEBHOOK_RESPONSE" | tail -n1)
BODY=$(echo "$WEBHOOK_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓${NC} Webhook endpoint is responding (HTTP $HTTP_CODE)"

    # Check if it's a validation error
    if echo "$BODY" | grep -q "Invalid webhook payload"; then
        echo -e "${YELLOW}!${NC} Webhook requires valid SendGrid format"
        echo "  This is expected - the endpoint is working!"
    elif echo "$BODY" | grep -q "ignored"; then
        echo -e "${YELLOW}!${NC} Email was ignored (loop/rate limit/duplicate)"
        echo "  Response: $BODY"
    elif echo "$BODY" | grep -q "success"; then
        echo -e "${GREEN}✓${NC} Webhook processed successfully!"
        echo "  Response: $BODY"
    fi
else
    echo -e "${RED}✗${NC} Webhook endpoint failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
fi

echo ""

# Test 3: Check Environment Variables
echo "🔑 Step 4: Checking environment variables..."
echo ""
echo "Please verify these are set in Vercel Dashboard:"
echo "  https://vercel.com/${DEPLOY_URL}/settings/environment-variables"
echo ""
echo "Required variables:"
echo "  ${BLUE}●${NC} ANTHROPIC_API_KEY"
echo "  ${BLUE}●${NC} RESEND_API_KEY"
echo "  ${BLUE}●${NC} RESEND_AGENT_EMAIL"
echo "  ${BLUE}●${NC} UPSTASH_REDIS_REST_URL"
echo "  ${BLUE}●${NC} UPSTASH_REDIS_REST_TOKEN"
echo ""
echo "Optional (for threat intel):"
echo "  ${BLUE}○${NC} VIRUSTOTAL_API_KEY"
echo "  ${BLUE}○${NC} ABUSEIPDB_API_KEY"
echo ""

# Test 4: Check SendGrid Configuration
echo "📮 Step 5: SendGrid Inbound Parse Configuration"
echo ""
echo "Go to SendGrid Dashboard:"
echo "  https://app.sendgrid.com/settings/parse"
echo ""
echo "Your webhook URL should be:"
echo "  ${BLUE}https://${DEPLOY_URL}/api/inbound${NC}"
echo ""
echo "Settings:"
echo "  • Host: inbound.g0tphish.com (or your domain)"
echo "  • URL: https://${DEPLOY_URL}/api/inbound"
echo "  • Check: POST data"
echo ""

# Common Issues
echo "⚠️  Common Issues:"
echo ""
echo "1. ${YELLOW}Email Loop Detected${NC}"
echo "   • Don't reply to analysis emails"
echo "   • Send a fresh email instead"
echo ""
echo "2. ${YELLOW}Rate Limit (10/hour per sender)${NC}"
echo "   • Wait 1 hour"
echo "   • Or use a different sender email"
echo ""
echo "3. ${YELLOW}Missing API Keys${NC}"
echo "   • System works with local tools only"
echo "   • But ANTHROPIC_API_KEY is required"
echo ""
echo "4. ${YELLOW}Wrong Email Address${NC}"
echo "   • Send TO: alert@inbound.g0tphish.com"
echo "   • Or whatever you configured in SendGrid"
echo ""
echo "5. ${YELLOW}Spam Folder${NC}"
echo "   • Check your spam/junk folder"
echo "   • Add sender to whitelist"
echo ""

# Logs
echo "📊 Step 6: Check Logs"
echo ""
echo "View real-time logs:"
echo "  ${BLUE}vercel logs ${DEPLOY_URL} --follow${NC}"
echo ""
echo "Or in Vercel Dashboard:"
echo "  https://vercel.com/dashboard → g0t-phish → Functions → /api/inbound"
echo ""

# Test Email
echo "📧 Step 7: Send Test Email"
echo ""
echo "Forward any email to:"
echo "  ${BLUE}alert@inbound.g0tphish.com${NC}"
echo ""
echo "Expected response time: 2-5 seconds"
echo "Check spam folder if not received in 30 seconds"
echo ""

echo "================================================"
echo "🔍 Debug Complete!"
echo ""
echo "If still no response, check:"
echo "  1. Vercel function logs"
echo "  2. SendGrid activity log"
echo "  3. Resend dashboard for sent emails"
echo ""
