# Element Call Widget Configuration Mismatch

## Issue
The Element Call widget's internal configuration has a homeserver mismatch that can cause delayed event update failures.

## Current Configuration

### Element Web Config (`config.json`)
```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://ms.beep.gov.pk",
      "server_name": "ms.beep.gov.pk"
    }
  },
  "element_call": {
    "url": "https://vs1.bservices-api.org.pk"
  }
}
```

### Element Call Widget Config (shown by user)
```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://call.ems.host",
      "server_name": "call.ems.host"
    }
  },
  "features": {
    "feature_use_device_session_member_events": true
  },
  "livekit": {
    "livekit_service_url": "https://livekit-jwt.vs1.bservices-api.org.pk"
  }
}
```

## Problem
1. **Element Web** loads the widget from: `https://vs1.bservices-api.org.pk`
2. **Element Web** passes `baseUrl: https://ms.beep.gov.pk` to the widget (via URL parameter)
3. **Element Call widget** has internal config pointing to: `https://call.ems.host`

This mismatch can cause:
- Authentication failures
- Session synchronization issues
- Delayed event update failures ("Failed to override function")
- MembershipManager shutdown

## Solution

The Element Call widget's `default_server_config` should match the homeserver that Element Web is using (`https://ms.beep.gov.pk`), OR the widget should be configured to respect the `baseUrl` parameter passed by Element Web.

### Option 1: Update Element Call Widget Config
Update the Element Call widget's `config.json` to use the same homeserver:

```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://ms.beep.gov.pk",
      "server_name": "ms.beep.gov.pk"
    }
  },
  "features": {
    "feature_use_device_session_member_events": true
  },
  "livekit": {
    "livekit_service_url": "https://livekit-jwt.vs1.bservices-api.org.pk"
  }
}
```

### Option 2: Ensure Widget Respects baseUrl Parameter
The Element Call widget should prioritize the `baseUrl` URL parameter over its internal `default_server_config`. This is typically how Element Call works, but verify that:
- The widget reads the `baseUrl` parameter from the URL hash
- The widget uses this `baseUrl` instead of its internal config
- The widget's Matrix client is initialized with the correct homeserver URL

## Verification
After fixing the config, verify:
1. The widget connects to `https://ms.beep.gov.pk` (not `call.ems.host`)
2. Delayed event updates succeed
3. MembershipManager doesn't shut down
4. Calls work properly

## Related Files
- `src/models/Call.ts` (line 677) - passes `baseUrl` to widget
- Element Call widget's `config.json` - needs to match or respect the passed `baseUrl`

