# Element Call Widget Timeout Issue - DIAGNOSIS

## Error:
```
Uncaught (in promise) Error: Failed to bind call widget in room !YrDijipvFckHTIpEBs:ms.beep.gov.pk: Error: Timed out
    at B.start (bundle.js:2:4530176)
```

## Root Cause:
The Element Call widget iframe is not initializing and sending the `StoreMessaging` event within the 16-second timeout period.

## Fixes Applied:

### 1. Increased Timeout (60 seconds)
**File:** `/src/models/Call.ts:53`
```typescript
const TIMEOUT_MS = 60000; // Increased from 16s to 60s for slow networks
```

### 2. Added Diagnostic Logging
**File:** `/src/models/Call.ts:240-264`
- Logs when waiting for widget messaging
- Logs each StoreMessaging event received  
- Logs successful widget messaging establishment
- Logs errors with detailed context

### 3. Server Connectivity Check
```bash
curl -I https://vs1.bservices-api.org.pk
```
**Result:** ✅ Server is accessible (HTTP/2 200)

## Next Steps to Debug:

### After Rebuild, Check Console For:

1. **Initial widget loading:**
   ```
   Widget messaging not ready for [widgetUid], waiting for StoreMessaging event...
   ```

2. **StoreMessaging events:**
   ```
   Received StoreMessaging event for uid: [widgetUid]
   ```

3. **Success:**
   ```
   Widget messaging established for [widgetUid]
   ```

4. **OR Failure:**
   ```
   Failed to establish widget messaging for [widgetUid]: Error: Timed out
   ```

## Possible Causes if Still Failing:

### 1. CORS/CSP Issues
The Element Call URL might be blocked by browser security policies.

**Check:** Browser console for CORS errors

**Fix:** Add to Element Call server headers:
```
Access-Control-Allow-Origin: *
Content-Security-Policy: frame-ancestors 'self' http://localhost:4500
```

### 2. Element Call Deployment Issue
The Element Call app at `https://vs1.bservices-api.org.pk` might not be properly configured.

**Check:** Open `https://vs1.bservices-api.org.pk/room` directly in browser

**Expected:** Should see Element Call interface or config page

### 3. Widget URL Parameters Missing
The widget URL might be missing required parameters.

**Check in Call.ts:656-705** - Element Call URL generation
- Ensure all template variables are being replaced
- Verify perParticipantE2EE is being passed correctly

### 4. iframe Sandbox Restrictions
The iframe's sandbox attributes might be too restrictive.

**Check AppTile.tsx:622-624** - Current sandbox flags:
```typescript
"allow-forms allow-popups allow-popups-to-escape-sandbox " +
"allow-same-origin allow-scripts allow-presentation allow-downloads"
```

### 5. Network/Firewall Blocking
Corporate firewall or network might block WebRTC/widget communication.

**Check:** Network tab in browser dev tools

## Testing Instructions:

1. **Rebuild the application:**
   ```bash
   npm run build
   ```

2. **Restart the server** (if running)

3. **Clear browser cache** and reload

4. **Open browser console** before joining call

5. **Attempt to start a call**

6. **Look for the diagnostic logs** mentioned above

7. **Check Network tab** for failed requests to:
   - `https://vs1.bservices-api.org.pk`
   - Widget API endpoints
   - WebRTC STUN/TURN servers

## Quick Test Element Call Directly:

Visit in browser: `https://vs1.bservices-api.org.pk/room`

If this fails or shows errors, the Element Call deployment itself has issues.
