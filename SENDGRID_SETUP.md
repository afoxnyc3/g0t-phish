# SendGrid Inbound Parse Setup Guide

This guide walks you through configuring SendGrid Inbound Parse to receive emails for g0t-phish phishing detection.

## Overview

**Architecture:**
- **SendGrid** receives inbound emails at `alert@inbound.g0tphish.com`
- **SendGrid Inbound Parse** POSTs email data to your webhook as `multipart/form-data`
- **g0t-phish** analyzes the email with Claude AI
- **Resend** sends the analysis report back to the user

## Prerequisites

- Domain: `g0tphish.com` (or your domain)
- Subdomain for email: `inbound.g0tphish.com` (or your choice)
- Vercel deployment URL (we'll deploy in next step)

## Step 1: Create SendGrid Account

1. Go to https://sendgrid.com
2. Sign up for a free account
   - Free tier includes:
     - 100 emails/day
     - Inbound Parse (unlimited receiving)
     - Email authentication
3. Verify your email address

## Step 2: Domain Authentication (Required)

1. Log in to SendGrid dashboard
2. Go to **Settings** → **Sender Authentication**
3. Click **Authenticate Your Domain**
4. Enter your domain: `g0tphish.com`
5. Select your DNS provider
6. Copy the provided DNS records (CNAME, TXT for DKIM/SPF)
7. Add these records to your domain's DNS settings
8. Wait 5-10 minutes for DNS propagation
9. Click **Verify** in SendGrid dashboard

**Example DNS records you'll need to add:**
```
Type: TXT
Host: @
Value: v=spf1 include:sendgrid.net ~all

Type: CNAME
Host: s1._domainkey
Value: s1.domainkey.u12345.wl.sendgrid.net

Type: CNAME
Host: s2._domainkey
Value: s2.domainkey.u12345.wl.sendgrid.net
```

## Step 3: Configure MX Records for Inbound Email

1. Go to your DNS provider (where you manage `g0tphish.com`)
2. Add MX records for your subdomain `inbound.g0tphish.com`:

```
Type: MX
Host: inbound
Priority: 10
Value: mx.sendgrid.net
```

**Note:** Some DNS providers require you to create an A record first:
```
Type: A
Host: inbound
Value: 167.89.118.50 (SendGrid's IP - check their docs for current IP)
```

3. Wait 5-10 minutes for DNS propagation
4. Verify MX records using `dig`:

```bash
dig MX inbound.g0tphish.com
```

Expected output:
```
;; ANSWER SECTION:
inbound.g0tphish.com. 300 IN MX 10 mx.sendgrid.net.
```

## Step 4: Create Inbound Parse Webhook

1. In SendGrid dashboard, go to **Settings** → **Inbound Parse**
2. Click **Add Host & URL**
3. Configure the parse webhook:

**Domain:** Select `g0tphish.com` from dropdown

**Subdomain:** `inbound` (or `alert.inbound` if you want `alert@inbound.g0tphish.com`)

**Destination URL:**
```
https://your-vercel-app.vercel.app/api/inbound
```
*(Replace with your actual Vercel deployment URL)*

**Settings:**
- ✅ **Check incoming emails for spam** (recommended - adds spam score to payload)
- ⬜ **Send raw** (leave UNCHECKED - we want parsed data)
- ⬜ **POST the raw, full MIME message** (leave UNCHECKED)

4. Click **Add**

## Step 5: Test the Integration

### Local Testing (Optional)

1. Make sure your dev server is running:
```bash
npm run dev
```

2. Use ngrok or similar to expose localhost:
```bash
ngrok http 3001
```

3. Update SendGrid webhook URL temporarily to your ngrok URL:
```
https://abc123.ngrok.io/api/inbound
```

4. Send a test email to `alert@inbound.g0tphish.com`

### Production Testing

1. Send an email to `alert@inbound.g0tphish.com`:

**Subject:** Can you check this email?

**Body:**
```
Hi,

I received a suspicious email asking me to verify my PayPal account.

Can you analyze it?

Thanks!
```

2. You should receive an analysis report within 5-10 seconds

3. Check Vercel logs for webhook activity:
```bash
vercel logs
```

## Step 6: Monitor and Verify

### SendGrid Dashboard

1. Go to **Activity** → **Inbound Parse**
2. View webhook POST attempts
3. Check for errors or failed deliveries

### Vercel Logs

```bash
vercel logs --follow
```

Look for:
```
[INFO] Webhook received
[INFO] Email parsed
[INFO] Analysis completed
[INFO] Processing completed successfully
```

### Test Commands

```bash
# Test webhook directly (after deployment)
curl -X POST https://your-app.vercel.app/api/inbound \
  -F "from=test@example.com" \
  -F "to=alert@inbound.g0tphish.com" \
  -F "subject=Test" \
  -F "text=Test body" \
  -F "headers=From: test@example.com" \
  -F "sender_ip=1.2.3.4" \
  -F "envelope={\"to\":[\"alert@inbound.g0tphish.com\"],\"from\":\"test@example.com\"}" \
  -F "attachments=0" \
  -F "dkim=pass" \
  -F "SPF=pass"
```

## Troubleshooting

### Email Not Received

1. **Check MX records:**
```bash
dig MX inbound.g0tphish.com
```

2. **Verify DNS propagation:**
```bash
nslookup -type=MX inbound.g0tphish.com 8.8.8.8
```

3. **Check SendGrid Activity:**
   - Go to SendGrid dashboard → Activity
   - Look for inbound email logs
   - Check for delivery failures

### Webhook Errors (400/500)

1. **Check Vercel logs:**
```bash
vercel logs --follow
```

2. **Verify webhook URL is correct** in SendGrid settings

3. **Test webhook endpoint:**
```bash
curl -X POST https://your-app.vercel.app/api/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### SendGrid Returns 550 Error

- **Cause:** MX records not configured correctly
- **Fix:** Verify MX records point to `mx.sendgrid.net` with priority 10

### Webhook Returns 400 "Invalid payload"

- **Cause:** Missing required fields (from, to, subject)
- **Fix:** Check SendGrid is sending all required fields
- **Verify:** Check Vercel logs for detailed error message

### Rate Limiting (429 Error)

- **Cause:** Too many emails from same sender (10/hour limit)
- **Check:** Redis logs in Vercel
- **Solution:** Wait 1 hour or adjust rate limits in `lib/rate-limiter.ts`

## Security Best Practices

### 1. Enable Webhook Signature Verification (Recommended for Production)

SendGrid supports ECDSA signature verification:

1. In SendGrid dashboard, go to **Settings** → **Inbound Parse**
2. Click on your webhook
3. Enable **Webhook Security**
4. Save the public key provided
5. Add signature verification to your webhook handler (see `app/api/inbound/route.ts`)

### 2. Use HTTPS Only

Ensure your webhook URL uses HTTPS (Vercel provides this automatically)

### 3. Monitor for Abuse

- Check SendGrid Activity for unusual patterns
- Monitor Vercel usage and costs
- Set up alerts for high email volume

## Cost Breakdown

### SendGrid Free Tier
- **Inbound:** Unlimited receiving (FREE)
- **Outbound:** 100 emails/day (FREE)
- **Overage:** $0.50/1,000 emails after 100/day

### Resend Free Tier (for outbound reports)
- **100 emails/day** (FREE)
- **3,000 emails/month** (FREE)
- **Overage:** $0.01/email after 3,000/month

### Expected Costs
- **0-100 emails/day:** $0/month (all free)
- **100-200 emails/day:** ~$1.50/month (SendGrid overage only)
- **500 emails/day:** ~$7/month (SendGrid + Resend)

## Next Steps

1. ✅ Complete this setup guide
2. Deploy to Vercel (see next section)
3. Update SendGrid webhook URL with production domain
4. Send test emails
5. Monitor logs and verify everything works
6. (Optional) Add signature verification for security

## Support Resources

- **SendGrid Docs:** https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
- **g0t-phish Issues:** File issues at your repository
- **Vercel Support:** https://vercel.com/support

---

**Last Updated:** 2025-10-24
**Version:** 1.0 (SendGrid Migration)
