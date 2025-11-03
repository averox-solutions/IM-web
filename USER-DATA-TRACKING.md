# User Data Tracking Implementation

## Overview

This document describes the implementation of the user data tracking feature that sends user information to a backend API when users log in or sign up.

## Architecture

### User Data Service (`src/utils/UserDataService.ts`)

A standalone utility service that handles:
1. **Device Information Collection**: Gathers browser, OS, screen resolution, language, and timezone
2. **Geolocation**: Requests user's location (with permission)
3. **API Communication**: Sends collected data to the backend

### Key Functions

#### `addDataForUser(userId: string, fcmToken?: string): Promise<void>`
Main function that collects and sends user data to the backend.

**Data Collected:**
- `userId`: Matrix user ID (e.g., `@username:homeserver`)
- `fcmtoken`: Firebase Cloud Messaging token (optional)
- `voipPush_ios`: VoIP push token for iOS (empty in web context)
- `is_iOS`: Boolean indicating if the platform is iOS
- `phraseRemember`: Recovery phrase (currently empty)
- `location`: `[latitude, longitude]` array or `null` if unavailable
- `deviceInfo`: Object containing:
  - `userAgent`: Full browser user agent string
  - `browser`: Browser name (e.g., "Chrome")
  - `browserVersion`: Browser version
  - `os`: Operating system name (e.g., "Windows")
  - `osVersion`: OS version
  - `platform`: Platform identifier
  - `screenResolution`: Format `WIDTHxHEIGHT` (e.g., "1920x1080")
  - `language`: User's preferred language
  - `timezone`: User's timezone

#### `getDeviceInfo(): DeviceInfo`
Collects device and browser information using `ua-parser-js`.

#### `getCurrentLocation(): Promise<[number, number] | null>`
Requests geolocation using browser's `navigator.geolocation` API.
- Returns `[latitude, longitude]` on success
- Returns `null` if geolocation is unavailable or denied
- Has 10-second timeout

#### `isUserDataServiceConfigured(): boolean`
Checks if the service is properly configured with API credentials.

## Integration Points

### 1. Login Flow (`src/components/structures/auth/Login.tsx`)

#### Without 2FA
When 2FA is disabled, user data is sent immediately after successful password login:

```typescript
if (!isEnabled) {
    // Send user data to backend before completing login
    if (isUserDataServiceConfigured() && this.loginCreds?.userId) {
        await addDataForUser(this.loginCreds.userId);
    }
    this.props.onLoggedIn(this.loginCreds!);
    return;
}
```

#### With 2FA
When 2FA is enabled, user data is sent after successful 2FA verification:

```typescript
console.log("2FA verification successful, logging in user");
// Send user data to backend after successful 2FA verification
if (isUserDataServiceConfigured() && this.loginCreds?.userId) {
    await addDataForUser(this.loginCreds.userId);
}
this.props.onLoggedIn(this.loginCreds!);
```

### 2. Registration Flow (`src/components/structures/auth/Registration.tsx`)

User data is sent after successful registration, before calling `onLoggedIn`:

```typescript
// Send user data to backend after successful registration
if (isUserDataServiceConfigured() && userId) {
    await addDataForUser(userId);
}

await this.props.onLoggedIn({
    userId,
    deviceId: (response as RegisterResponse).device_id!,
    homeserverUrl: this.state.matrixClient.getHomeserverUrl(),
    identityServerUrl: this.state.matrixClient.getIdentityServerUrl(),
    accessToken,
});
```

## Configuration

### Environment Variables

See `ENV_VARIABLES.md` for full details. Key variables:

- `REACT_APP_BSERVICES_API_KEY`: API key for authentication (required)
- `REACT_APP_USER_DATA_API_URL`: Backend API URL (defaults to `https://bservices-api.org.pk`)

### Backend API Endpoint

**POST** `/api/users`

**Headers:**
```
x-api-key: <API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "@username:homeserver",
  "fcmtoken": "",
  "voipPush_ios": "",
  "is_iOS": false,
  "phraseRemember": "",
  "location": [40.7128, -74.0060],
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "browser": "Chrome",
    "browserVersion": "120.0.0.0",
    "os": "Windows",
    "osVersion": "10",
    "platform": "Win32",
    "screenResolution": "1920x1080",
    "language": "en-US",
    "timezone": "America/New_York"
  }
}
```

**Response:**
- `200 OK`: Data stored successfully
- `4xx/5xx`: Error (logged but doesn't block login/registration)

## Error Handling

The service is designed to fail gracefully:
- If the API is unreachable, errors are logged but don't prevent login/registration
- If geolocation permission is denied, `location` is set to `null`
- If the service is not configured, no API calls are made

## Privacy Considerations

- Geolocation requires user permission via browser API
- All data is sent over HTTPS
- API key authentication prevents unauthorized access
- Data collection is transparent and occurs only at login/signup

## Comparison with Flutter Implementation

The web implementation mirrors the Flutter app's functionality:

| Feature | Flutter | Web |
|---------|---------|-----|
| User ID | ✅ | ✅ |
| FCM Token | ✅ | ✅ (optional) |
| VoIP Push | ✅ (iOS) | ⚠️ (empty, web context) |
| Location | ✅ | ✅ (browser API) |
| Device Info | ✅ | ✅ (ua-parser-js) |
| API Endpoint | `/api/users` | `/api/users` |
| Authentication | x-api-key | x-api-key |

## Testing

To test the implementation:

1. Set environment variables in `.env`
2. Open browser DevTools Console
3. Login or register a new account
4. Look for log messages:
   - `"Sending user data payload:"` - Data being sent
   - `"User data sent successfully:"` - Success response
   - `"Failed to send user data:"` or `"Error sending user data:"` - Error cases

## Future Enhancements

Potential improvements:
- Add FCM token collection for push notifications
- Implement retry logic for failed API calls
- Add analytics to track collection success rates
- Support for additional device information
- Batch data collection for performance

