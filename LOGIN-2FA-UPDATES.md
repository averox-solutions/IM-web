# Login.tsx - 2FA Debugging Updates

## Changes Made

Added comprehensive console logging to track the 2FA flow and help diagnose any `isConfigured` state issues.

### 1. Status Check Logging (Lines 241-246)

```typescript
const status = await statusRes.json();
console.log("2FA status response:", status);
// ...
const isEnabled = !!status.isEnabled;
const isConfigured = !!status.isConfigured;
console.log("2FA status - isEnabled:", isEnabled, "isConfigured:", isConfigured);
```

**Purpose**: Track what the backend returns for 2FA status immediately after password login.

### 2. QR Generation Logging (Lines 259-269)

```typescript
if (!isConfigured) {
    console.log("User not configured, generating QR...");
    // ... fetch /2fa/generate
    const gen = await genRes.json();
    console.log("Generate response:", gen);
    // ...
}
```

**Purpose**: Verify when QR generation is triggered and what data is returned.

### 3. Already Configured Logging (Lines 279)

```typescript
} else {
    console.log("User already configured, showing OTP input only");
    // ...
}
```

**Purpose**: Confirm when the "already configured" path is taken.

### 4. Verification Success Logging (Line 532)

```typescript
console.log("2FA verification successful, logging in user");
this.props.onLoggedIn(this.loginCreds!);
```

**Purpose**: Track successful OTP verification before final login.

### 5. Bug Fixes

- **Line 486**: Added type assertion `error as Error` for `messageForConnectionError`
- **Line 511**: Added type assertion `TWO_FA_API_KEY as string` for fetch headers
- **Line 673**: Added missing `showPassword={false}` prop to `PasswordLogin` component

## Expected Console Output

### Scenario 1: User NOT Configured (First Time)

```
2FA status response: { username: "...", isEnabled: true, isConfigured: false, ... }
2FA status - isEnabled: true isConfigured: false
User not configured, generating QR...
Generate response: { qr: "data:image/png...", secret: "...", ... }
```

### Scenario 2: User Already Configured

```
2FA status response: { username: "...", isEnabled: true, isConfigured: true, ... }
2FA status - isEnabled: true isConfigured: true
User already configured, showing OTP input only
```

### Scenario 3: 2FA Disabled

```
2FA status response: { username: "...", isEnabled: false, isConfigured: false, ... }
2FA status - isEnabled: false isConfigured: false
(No 2FA UI shown, user logs in directly)
```

### Scenario 4: Successful Verification

```
2FA verify response: {"message":"OTP verified successfully"}
2FA verification successful, logging in user
```

## How to Debug

1. **Open DevTools Console** before logging in
2. **Enter credentials** and submit
3. **Watch console output** to see the 2FA flow
4. **Compare with expected output** above

## Key Points

- `isConfigured: false` means the user has NOT verified an OTP yet
- `isConfigured: true` means the user HAS successfully verified an OTP in the past
- The backend sets `isConfigured: true` ONLY after `/2fa/verify` succeeds
- QR code should ONLY show when `isEnabled: true` AND `isConfigured: false`

## Related Files

- `SetIdServer.tsx` - Settings page 2FA toggle (also updated with logging)
- `2FA-ISSUE-ANALYSIS.md` - Full analysis of the `isConfigured` issue
- `test-2fa-api.js` - API testing script

