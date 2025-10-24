# Resend Setup Guide for g0t-phish

## Current Configuration

- **Domain**: `inbound.g0tphish.com`
- **Agent Email**: `alert@inbound.g0tphish.com`
- **API Key**: Configured ✅

---

## Step 1: Verify Domain Setup in Resend

Go to: https://resend.com/domains

### Check Domain Status

Your domain `inbound.g0tphish.com` should show:
- ✅ **Verified** (green checkmark)
- ✅ All DNS records added

### Required DNS Records

You need these DNS records for `inbound.g0tphish.com`:

#### 1. MX Record (for receiving emails)
```
Type: MX
Host: inbound.g0tphish.com
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
TTL: 3600 (or Auto)
```

#### 2. TXT Record (SPF - for sending emails)
```
Type: TXT
Host: inbound.g0tphish.com
Value: v=spf1 include:amazonses.com ~all
TTL: 3600 (or Auto)
```

#### 3. CNAME Records (DKIM - for email authentication)

Resend will give you 3 DKIM records that look like:
```
Type: CNAME
Host: <unique-id>._domainkey.inbound.g0tphish.com
Value: <unique-id>.dkim.amazonses.com
TTL: 3600 (or Auto)
```

**Get your specific DKIM values from:**
https://resend.com/domains → Click on `inbound.g0tphish.com` → Copy DNS records

---

## Step 2: Configure Inbound Email Routing

Go to: https://resend.com/inbound

### Create Inbound Route

1. Click **"Create Route"** or **"Add Route"**
2. Fill in:
   - **Match**: `alert@inbound.g0tphish.com` (exact email address)
   - **Forward to**: `http://localhost:3001/api/inbound` (for local testing)
   - **OR** (for production): `https://your-project.vercel.app/api/inbound`

3. **Enable the route** (toggle should be ON)

### Alternative: Catch-All Route

If you want to receive on ANY email address @inbound.g0tphish.com:
- **Match**: `*@inbound.g0tphish.com`
- **Forward to**: Same webhook URL

---

## Step 3: Verify DNS Propagation

DNS changes can take 1-24 hours. Check status:

### Using Resend Dashboard
- Go to https://resend.com/domains
- Check if `inbound.g0tphish.com` shows green ✅

### Manual DNS Check (Terminal)

```bash
# Check MX record
dig MX inbound.g0tphish.com

# Expected: feedback-smtp.us-east-1.amazonses.com

# Check SPF record
dig TXT inbound.g0tphish.com

# Expected: v=spf1 include:amazonses.com ~all

# Check DKIM records
dig CNAME <your-dkim-id>._domainkey.inbound.g0tphish.com
```

### Online DNS Checker
- Visit: https://mxtoolbox.com/SuperTool.aspx
- Enter: `inbound.g0tphish.com`
- Check: MX, SPF, DKIM records

---

## Step 4: Test Email Reception (After DNS Verified)

### Send Test Email

From your personal email (Gmail, etc.), send to:
```
To: alert@inbound.g0tphish.com
Subject: Test phishing email
Body: Click here: http://suspicious-link.com
```

### Check Resend Logs

Go to: https://resend.com/logs

You should see:
1. **Inbound email received**
2. **Webhook sent** to your endpoint
3. **Status: 200** (success)

If you see errors:
- **404**: Check webhook URL is correct
- **500**: Check server logs for errors
- **Timeout**: Server took >10s to respond

---

## Step 5: Test with Test Script

We've created a test script to simulate a webhook locally:

```bash
cd /Users/alex/mvp/g0t-phish
./test-webhook.sh
```

This sends a mock Resend webhook to your local server.

---

## Common Issues & Solutions

### Issue: Domain not verified
**Solution**: Wait for DNS propagation (can take up to 24 hours). Check DNS records are correct.

### Issue: Emails not arriving
**Possible causes:**
1. MX record not set up correctly
2. Inbound route not configured
3. Email address doesn't match route pattern
4. DNS not propagated yet

**Debug:**
- Check Resend logs: https://resend.com/logs
- Verify MX record: `dig MX inbound.g0tphish.com`

### Issue: Webhook returns 500
**Solution**: Check server logs for errors. Verify all environment variables are set.

### Issue: Webhook times out
**Solution**: Claude API might be slow. Check:
- ANTHROPIC_API_KEY is valid
- Claude API is responding
- No network issues

---

## Production Deployment Checklist

When deploying to Vercel:

1. ✅ Domain verified in Resend
2. ✅ Inbound route configured
3. ✅ Update inbound route webhook URL to Vercel URL
4. ✅ Add all environment variables to Vercel
5. ✅ Test with real email
6. ✅ Monitor Vercel function logs
7. ✅ Monitor Resend webhook logs

---

## Support

- **Resend Documentation**: https://resend.com/docs
- **Resend Inbound Guide**: https://resend.com/docs/send-with-nextjs#inbound-emails
- **DNS Troubleshooting**: https://mxtoolbox.com/

---

**Last Updated**: 2025-10-24
**Your Domain**: inbound.g0tphish.com
**Agent Email**: alert@inbound.g0tphish.com
