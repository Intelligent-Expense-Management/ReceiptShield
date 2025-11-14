# Solving Google Gemini API Rate Limits

## Understanding the Issue

Rate limits occur when you exceed the API's request quota. This can happen due to:
- Free tier API keys with strict limits
- Exceeding daily/monthly quotas
- Too many requests per minute/second
- Using experimental models with lower limits

## Solutions (in order of recommendation)

### 1. **Check Your API Key Type & Quota**

#### Check Current Quota:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click on your API key
3. Check the "Quota" section to see:
   - Requests per minute (RPM)
   - Requests per day (RPD)
   - Tokens per minute (TPM)

#### Check Usage:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Dashboard"
3. Select "Generative Language API"
4. Check "Quotas" tab to see current usage

### 2. **Upgrade to Paid Tier**

Free tier has very strict limits. To upgrade:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing for your project
3. Go to "APIs & Services" → "Quotas"
4. Request quota increase for:
   - Requests per minute
   - Requests per day
   - Tokens per minute

**Typical Free Tier Limits:**
- 15 requests per minute (RPM)
- 1,500 requests per day (RPD)
- 1 million tokens per minute (TPM)

**Paid Tier Benefits:**
- Higher rate limits
- Better reliability
- Priority support

### 3. **Switch to a Stable Model**

The code currently uses `gemini-2.0-flash-exp` (experimental), which may have stricter limits.

**Option A: Use Stable Model**
Update your `.env.local`:
```env
GEMINI_MODEL=gemini-1.5-flash
# or
GEMINI_MODEL=gemini-1.5-pro
```

**Option B: Update in Code**
Edit `src/app/api/ai-assistant/route.ts`:
```typescript
const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'; // Changed from gemini-2.0-flash-exp
```

### 4. **Implement Request Caching**

Cache responses for common questions to reduce API calls:

```typescript
// Add to src/app/api/ai-assistant/route.ts
const cache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Before API call:
const cacheKey = `${message.toLowerCase().trim()}`;
const cached = cache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  return NextResponse.json({
    response: cached.response,
    error: null,
    suggestUpload: false
  });
}
```

### 5. **Add Request Throttling**

Limit requests per user/IP to prevent abuse:

```typescript
// Add rate limiting middleware
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 5;

const userId = request.headers.get('x-user-id') || 'anonymous';
const now = Date.now();
const userLimit = userRequestCounts.get(userId);

if (userLimit && userLimit.resetTime > now) {
  if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    return NextResponse.json({
      response: "You've made too many requests. Please wait a moment.",
      error: 'RATE_LIMIT_EXCEEDED',
      suggestUpload: false
    }, { status: 429 });
  }
  userLimit.count++;
} else {
  userRequestCounts.set(userId, { count: 1, resetTime: now + 60000 });
}
```

### 6. **Use Multiple API Keys (Rotation)**

If you have multiple API keys, rotate them:

```typescript
const apiKeys = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY_2,
  process.env.GOOGLE_AI_API_KEY_3,
].filter(Boolean);

let currentKeyIndex = 0;
const getNextApiKey = () => {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
};
```

### 7. **Optimize Request Frequency**

- Batch multiple questions if possible
- Reduce unnecessary API calls
- Use shorter prompts to reduce token usage
- Implement debouncing on the frontend

### 8. **Monitor and Alert**

Add monitoring to track rate limit hits:

```typescript
// Log rate limit events
if (response.status === 429) {
  console.error('Rate limit hit:', {
    timestamp: new Date().toISOString(),
    model,
    apiKey: apiKey.substring(0, 10) + '...',
  });
  
  // Send to monitoring service (e.g., Sentry, LogRocket)
  // trackEvent('rate_limit_exceeded', { model, timestamp });
}
```

## Quick Fix: Switch to Stable Model

The fastest solution is to switch from the experimental model:

1. **Update `.env.local`:**
```env
GEMINI_MODEL=gemini-1.5-flash
```

2. **Or update the default in code:**
```typescript
// src/app/api/ai-assistant/route.ts line 37
const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
```

3. **Restart your dev server:**
```bash
npm run dev
```

## Long-term Solution

1. **Enable billing** in Google Cloud Console
2. **Request quota increase** for your use case
3. **Monitor usage** to understand your patterns
4. **Implement caching** for common queries
5. **Add request throttling** to prevent abuse

## Testing Your Solution

After implementing changes, test with:
```bash
# Check if rate limits are resolved
curl -X POST http://localhost:9003/api/ai-assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## Additional Resources

- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Google Cloud Quotas](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
- [Pricing Information](https://ai.google.dev/pricing)

