# Instagram OAuth Setup Guide

## Overview
This guide explains how to properly configure Instagram OAuth integration for BizNavigate.

## Current Configuration

### Environment Variables (.env)
```
FACEBOOK_APP_ID=2673061953051055
FACEBOOK_APP_SECRET=ce8e3e0c00a14e007b2fc3a8f7f1aa65
FACEBOOK_WEBHOOK_VERIFY_TOKEN=verify1122
INSTAGRAM_API_VERSION=v18.0
INSTAGRAM_OAUTH_REDIRECT_URI=https://stoutly-paragraphistical-charline.ngrok-free.dev/instagram/auth/callback
```

### Backend URLs
- **Backend URL**: `https://stoutly-paragraphistical-charline.ngrok-free.dev`
- **Frontend URL**: `http://localhost:3000`
- **OAuth Callback**: `https://stoutly-paragraphistical-charline.ngrok-free.dev/instagram/auth/callback`

## Facebook App Configuration Required

### 1. Basic Settings
**URL**: https://developers.facebook.com/apps/1197134552334122/settings/basic/

Add the following:

#### App Domains
```
stoutly-paragraphistical-charline.ngrok-free.dev
```
(Domain only, no `https://` or paths)

#### Website - Site URL
```
https://stoutly-paragraphistical-charline.ngrok-free.dev
```

### 2. Facebook Login Settings
**URL**: https://developers.facebook.com/apps/1197134552334122/fb-login/settings/

#### Valid OAuth Redirect URIs
Add **EXACTLY** this URL:
```
https://stoutly-paragraphistical-charline.ngrok-free.dev/instagram/auth/callback
```

**IMPORTANT**: The URL must match EXACTLY (including https, domain, and path)

### 3. App Mode Configuration

#### For Development (Current)
- **Mode**: Development
- **Required**: Add your Facebook account as Admin/Developer/Tester
- **URL**: https://developers.facebook.com/apps/1197134552334122/roles/roles/

#### For Production
- Switch to "Live" mode
- Complete App Review for required permissions
- Add Privacy Policy URL
- Add Terms of Service URL (optional)

### 4. Required Permissions

The app requests these Instagram permissions:
- `instagram_basic` - Basic Instagram account info
- `instagram_content_publish` - Publish posts
- `instagram_manage_comments` - Manage comments
- `instagram_manage_insights` - View insights/analytics
- `instagram_manage_messages` - Manage direct messages
- `pages_read_engagement` - Read Facebook Page engagement
- `pages_manage_metadata` - Manage Page metadata
- `pages_show_list` - List Facebook Pages

**Note**: Some permissions require App Review approval before going Live.

## OAuth Flow

### Step 1: Generate OAuth URL
```
GET /instagram/auth/url?businessId={businessId}
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://www.facebook.com/v18.0/dialog/oauth?client_id=XXX&redirect_uri=https://...&scope=instagram_basic,..."
  }
}
```

### Step 2: User Authorization
Frontend redirects user to the OAuth URL. User logs in to Facebook and grants permissions.

### Step 3: Facebook Callback
Facebook redirects to:
```
https://stoutly-paragraphistical-charline.ngrok-free.dev/instagram/auth/callback?code=XXX&state=base64(businessId:timestamp)
```

### Step 4: Token Exchange
Backend automatically:
1. Verifies `state` parameter (CSRF protection)
2. Exchanges `code` for short-lived access token
3. Exchanges short-lived token for long-lived token (60 days)
4. Redirects to frontend with success:
```
http://localhost:3000/settings/instagram/callback?success=true&access_token=XXX&expires_in=5184000&business_id=XXX
```

### Step 5: Connect Account
Frontend calls:
```
POST /instagram/accounts/connect
{
  "facebookPageId": "...",
  "accessToken": "...",
  "businessId": "..."
}
```

Backend:
1. Fetches Instagram Business Account linked to Facebook Page
2. Encrypts access token (AES-256-CBC)
3. Saves to `social_accounts` table
4. Returns account details

## Troubleshooting

### Error: "App not active"
**Cause**: Facebook App is in Development Mode
**Solution**: Add yourself as Admin/Developer/Tester in App Roles

### Error: "Can't load URL - domain not included"
**Cause**: ngrok domain not in App Domains
**Solution**: Add domain to App Domains in Basic Settings

### Error: "Invalid redirect URI"
**Cause**: Redirect URI not in allowed list or doesn't match exactly
**Solution**: Add exact URL to Valid OAuth Redirect URIs in Facebook Login Settings

### Error: "Missing code or state"
**Cause**: Facebook OAuth flow was interrupted or blocked
**Solutions**:
1. Verify redirect URI is in Facebook App settings
2. Check that you're added as tester/admin (for Development Mode)
3. Clear browser cache and try again
4. Check Facebook App is active

### Error: "User account is inactive"
**Cause**: User's `is_active` field is false or cached value is stale
**Solution**:
1. Verify user is active in database
2. Clear Redis cache: `redis-cli FLUSHALL`
3. Re-login to get new token

### Error: "Unauthorized" (401)
**Cause**: JWT access token expired (24-hour lifespan)
**Solution**: Use refresh token endpoint or re-login

## Security Notes

### Token Encryption
Access tokens are encrypted using AES-256-CBC before storage:
```typescript
Algorithm: aes-256-cbc
Key: scrypt(FACEBOOK_APP_SECRET, 'salt', 32)
IV: random 16 bytes
Format: {iv_hex}:{encrypted_hex}
```

### State Parameter (CSRF Protection)
State format: `base64(businessId:timestamp)`
- Expires after 30 minutes
- Prevents CSRF attacks
- Validates business ownership

### Token Expiry
- **Short-lived token**: 1 hour
- **Long-lived token**: 60 days
- **JWT access token**: 24 hours
- **JWT refresh token**: 7 days

## ngrok Considerations

⚠️ **ngrok URLs change on restart** - You'll need to update Facebook App settings each time

### Option 1: Fixed ngrok Domain (Free)
```bash
ngrok http 3006 --domain=your-fixed-subdomain.ngrok-free.app
```

### Option 2: Paid ngrok (Recommended for Production)
- Get a permanent domain
- No need to update Facebook settings
- More reliable for webhooks

## Testing Checklist

Before testing the OAuth flow:

- [ ] Facebook App ID and Secret are correct in `.env`
- [ ] ngrok is running and URL is up-to-date in `.env`
- [ ] Domain added to **App Domains** in Facebook Basic Settings
- [ ] Redirect URI added to **Valid OAuth Redirect URIs** in Facebook Login Settings
- [ ] You are added as **Admin/Developer/Tester** (for Development Mode)
- [ ] Backend is running on port 3006
- [ ] Frontend is running on port 3000
- [ ] Kafka and Redis are running
- [ ] Database is accessible

## Quick Test

1. **Get OAuth URL**:
```bash
curl -X GET "http://localhost:3006/instagram/auth/url?businessId=YOUR_BUSINESS_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Open the URL** in browser and authorize

3. **Check callback** - Should redirect to frontend with success params

4. **Connect account** - Frontend should call `/instagram/accounts/connect`

5. **Verify** - Check `social_accounts` table for new record

## Production Deployment

Before going live:

1. **Switch to Production URLs**:
   - Update `INSTAGRAM_OAUTH_REDIRECT_URI` to production backend URL
   - Update `BACKEND_URL` and `FRONTEND_URL`

2. **Update Facebook App**:
   - Add production domain to App Domains
   - Add production callback to OAuth Redirect URIs
   - Submit for App Review (required permissions)
   - Add Privacy Policy URL
   - Switch to Live mode

3. **Security**:
   - Rotate `FACEBOOK_APP_SECRET`
   - Use secure environment variables (not `.env` file)
   - Enable HTTPS only
   - Implement rate limiting
   - Monitor for suspicious activity

4. **Monitoring**:
   - Set up logging for OAuth failures
   - Monitor token expiration
   - Track API rate limits
   - Alert on circuit breaker trips

## Support

- **Facebook Developer Docs**: https://developers.facebook.com/docs/instagram-api
- **Instagram Graph API**: https://developers.facebook.com/docs/instagram-api/
- **OAuth 2.0 Flow**: https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow

---

**Last Updated**: December 10, 2025
**Version**: 1.0.0
