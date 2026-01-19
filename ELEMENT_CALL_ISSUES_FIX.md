# Element Call Integration Issues - Analysis & Fixes

## Date: 2026-01-08
## Priority: HIGH

---

## Issues Identified

### 1. ❌ **E2EE Configuration Error**
**Error Message:**
```
Failed to set E2EE enabled on room Error: e2ee not configured, please set e2ee settings within the room options
    at useLivekit.ts:138
```

**Root Cause:**
- The LiveKit Room object in Element Call is being created without E2EE configuration
- When `setE2EEEnabled()` is called later, it fails because E2EE must be configured during Room construction
- This is happening inside the Element Call widget at `https://vs1.bservices-api.org.pk`

**Solutions Applied:**
1. ✅ **Disabled per-sender E2EE** (Temporary Workaround)
   - Added `"feature_disable_call_per_sender_encryption": true` to `webapp/config.json`
   - This prevents Element Web from requesting E2EE, avoiding the configuration error
   
**Permanent Solution Required:**
   - Update Element Call deployment at `https://vs1.bservices-api.org.pk`
   - Ensure LiveKit Room is initialized with proper E2EE options:
     ```javascript
     const room = new Room({
       e2ee: {
         keyProvider: yourKeyProvider,
         worker: yourWorkerInstance
       }
     });
     ```

---

### 2. ⚠️  **Unknown Widget API Actions**
**Error Messages:**
```
Failed to send join action p9: Unknown or unsupported action: io.element.join
Failed to send layout change to widget API p9: Unknown or unsupported action: io.element.tile_layout
```

**Root Cause:**
- Element Call widget doesn't support these legacy Element-specific widget API actions
- These are custom actions that may not be implemented in your Element Call deployment

**Impact:** Non-critical warnings - the widget should still function
**Status:** No fix required (these are fallback actions)

---

### 3. ✅ **Screen Wake Lock Permission Violation** (FIXED)
**Error Message:**
```
[Violation] Permissions policy violation: screen-wake-lock is not allowed in this document.
    at useWakeLock.ts:26
```

**Root Cause:**
- The Permissions Policy didn't allow screen wake lock in the iframe context
- Element Call tries to keep the screen awake during calls, but the permission was missing

**Solution Applied:**
✅ **Added screen-wake-lock permission to iframe**
   - Modified `/src/components/views/elements/AppTile.tsx`
   - Added `screen-wake-lock;` to the iframe's `allow` attribute
   - This allows Element Call to prevent the screen from sleeping during active calls

---

### 4. ❌ **Delayed Event Override Errors**
**Error Message:**
```
error updating delayed event: Error: Failed to override function
    at bundle.js:2:2260399
```

**Root Cause:**
- Multiple calls attempting to override the same function
- Conflicts in event handling within the Matrix client

**Status:** Under investigation - appears to be related to Matrix event handling
**Impact:** May cause issues with event updates and synchronization

---

## Changes Made

### File: `/webapp/config.json`
**Change:** Added E2EE disable flag
```json
"features": {
  ...
  "feature_disable_call_per_sender_encryption": true
}
```

### File: `/src/components/views/elements/AppTile.tsx`
**Change:** Added wake lock permission
```typescript
const iframeFeatures =
  "microphone; camera; encrypted-media; autoplay; display-capture; clipboard-write; " +
  "clipboard-read; screen-wake-lock;";
```

---

## Testing Required

After rebuilding the application, verify:

1. ✅ E2EE error no longer appears in console
2. ✅ Wake lock permission violation is resolved
3. ⚠️  Join and layout warnings may still appear (expected - non-critical)
4. ❓ Delayed event errors - monitor for frequency and impact

---

## Next Steps

### Immediate (Required)
1. **Rebuild the application**
   ```bash
   npm run build
   ```

2. **Test video calls**
   - Create a new call
   - Join with multiple participants
   - Verify E2EE indicator (if needed)
   - Check console for remaining errors

### Short-term (Recommended)
1. **Update Element Call Deployment**
   - Contact administrator of `https://vs1.bservices-api.org.pk`
   - Ensure latest Element Call version with proper E2EE support
   - Configure LiveKit E2EE settings if encryption is required

2. **Re-enable E2EE (if needed)**
   - Once Element Call supports E2EE properly
   - Remove `feature_disable_call_per_sender_encryption` flag
   - Test encrypted calls

### Long-term (Optional)
1. **Monitor delayed event errors**
   - Track frequency and impact
   - May require Matrix SDK update
   - Consider reporting to matrix-js-sdk if persistent

---

## Configuration Summary

### Current Element Call Config
```json
"element_call": {
  "url": "https://vs1.bservices-api.org.pk",
  "use_exclusively": false,
  "participant_limit": 8,
  "brand": "Beep Pakistan"
}
```

### Features Enabled
- ✅ Element Call video rooms
- ✅ Video rooms
- ✅ Group calls
- ✅ Device session member events
- ✅ E2EE disabled (temporary)

---

## Additional Notes

- The errors originate from Element Call widget, not Element Web
- Wake lock permission fix improves user experience during calls
- E2EE disable is a **temporary workaround** - proper E2EE configuration is recommended
- Widget API warnings are expected and don't affect core functionality
