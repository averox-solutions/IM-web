# CORS Error Fix for Admin API

## Understanding the Error

The error you're seeing:
```
Access to fetch at 'https://admin.beep.gov.pk/api/ministries' from origin 'http://localhost:4500' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

This is a **CORS (Cross-Origin Resource Sharing)** error. It occurs when:
- Your frontend runs on `http://localhost:4500` (development)
- The API is at `https://admin.beep.gov.pk` (different origin)
- The API server doesn't include CORS headers allowing requests from `localhost:4500`

## Solutions

### ✅ Solution 1: Webpack DevServer Proxy (Implemented)

**Status:** ✅ Already configured

A proxy has been added to `webpack.config.js` that forwards API requests through the dev server, avoiding CORS issues in development.

**How it works:**
- In development, requests to `/api/ministries` are proxied to `https://admin.beep.gov.pk/api/ministries`
- The browser sees the request as same-origin (localhost:4500)
- No CORS headers needed

**To use:**
1. Restart your dev server (`yarn start`)
2. The code automatically uses relative paths in development
3. Requests will go through the proxy

### Solution 2: Backend Proxy (For Production)

If you need this in production, create a backend endpoint that fetches the data:

**Example Node.js/Express:**
```javascript
app.get('/api/ministries', async (req, res) => {
    try {
        const response = await fetch('https://admin.beep.gov.pk/api/ministries');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ministries' });
    }
});
```

Then update `MinistryUtils.ts` to use your backend endpoint in production.

### Solution 3: API Server CORS Configuration (Best Long-term)

**Requires backend access** - Ask your backend team to add CORS headers:

```javascript
// Example Express.js CORS configuration
app.use(cors({
    origin: [
        'http://localhost:4500',
        'https://your-production-domain.com'
    ],
    credentials: true
}));
```

Or add headers directly:
```
Access-Control-Allow-Origin: http://localhost:4500
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Current Implementation

The code now:
1. **Development:** Uses relative paths (`/api/ministries`) → goes through webpack proxy
2. **Production:** Uses full URL (`https://admin.beep.gov.pk/api/ministries`) → direct API call

**Environment Detection:**
- Checks `NODE_ENV === "development"` or `REACT_APP_ENV === "dev"`
- Automatically switches between proxy and direct API calls

## Testing

1. **Restart your dev server:**
   ```bash
   yarn start
   ```

2. **Check browser console:**
   - Should see requests to `/api/ministries` (not the full URL)
   - No CORS errors

3. **Verify proxy is working:**
   - Open Network tab in DevTools
   - Look for requests to `/api/ministries`
   - Status should be 200 OK
   - Response should contain ministry data

## Troubleshooting

### Proxy not working?
1. Make sure dev server is restarted
2. Check `webpack.config.js` proxy configuration
3. Verify `NODE_ENV` is set to `development`

### Still getting CORS errors?
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Check if proxy is actually intercepting requests in Network tab

### Production issues?
- Ensure `REACT_APP_ADMIN_API_URL` is set correctly
- Or backend proxy is configured
- Or API server has CORS headers configured

## Notes

- The proxy only works in **development mode**
- In **production**, you'll need either:
  - Backend proxy endpoint
  - API server CORS configuration
  - Or same-origin deployment
