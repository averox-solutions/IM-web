# Current Login Authentication Flow

This document describes the complete login authentication flow in the Element/Matrix application.

## Overview

The login flow supports multiple authentication methods:
1. **Password Login** (username/phone + password)
2. **SSO/Token Login** (Single Sign-On via token)
3. **OIDC Native Flow** (OpenID Connect)
4. **2FA Integration** (Two-Factor Authentication - custom implementation)

---

## Main Flow Entry Points

### 1. App Initialization
**File:** `src/components/structures/MatrixChat.tsx`
- **Line 481:** `startInitSession()` called in `componentDidMount()`
- **Line 315-376:** `initSession()` - Main initialization logic that:
  - Checks session lock
  - Handles soft logout
  - Attempts delegated auth (OIDC/token)
  - Falls back to `loadSession()` to restore from storage
  - Shows login screen if no session found

### 2. Login Component
**File:** `src/components/structures/auth/Login.tsx`
- **Line 105:** `LoginComponent` - Main login UI component
- **Line 229-422:** `onPasswordLogin()` - Handles password-based login

---

## Password Login Flow (Detailed)

### Step 1: User Submits Credentials
**File:** `src/components/views/auth/PasswordLogin.tsx`
- **Line 97-119:** `onSubmitForm()` - Form submission handler
- Calls `this.props.onSubmit()` with username/phone and password

### Step 2: Login Component Receives Credentials
**File:** `src/components/structures/auth/Login.tsx`
- **Line 229-422:** `onPasswordLogin()` method:
  - **Line 235-244:** Validates username (prevents email login)
  - **Line 246-256:** Formats username as `@username:ms.beep.gov.pk`
  - **Line 258-282:** Validates server is alive
  - **Line 284-286:** Clears any saved 2FA state
  - **Line 295:** Calls `this.loginLogic.loginViaPassword()`

### Step 3: Login Logic Performs Authentication
**File:** `src/Login.ts`
- **Line 136-205:** `loginViaPassword()` method:
  - **Line 142-150:** Prevents email login
  - **Line 152-172:** Builds identifier object (user/phone)
  - **Line 174-178:** Creates login parameters
  - **Line 191:** Calls `sendLoginRequest()` to Matrix server
  - Returns `IMatrixClientCreds` on success

**File:** `src/Login.ts`
- **Line 260-297:** `sendLoginRequest()` function:
  - **Line 266-269:** Creates temporary Matrix client
  - **Line 271:** Calls `client.login()` with credentials
  - **Line 273-284:** Handles well-known server redirects
  - **Line 286-292:** Returns credentials object with:
    - `homeserverUrl`
    - `identityServerUrl`
    - `userId`
    - `deviceId`
    - `accessToken`

### Step 4: 2FA Check (Custom Implementation)
**File:** `src/components/structures/auth/Login.tsx`
- **Line 296-397:** After successful password login:
  - **Line 301-310:** Checks 2FA status via API:
    ```typescript
    GET ${TWO_FA_BASE_URL}/2fa/status/${username}
    ```
  - **Line 312-314:** Determines if 2FA is enabled/configured
  
  **If 2FA Disabled:**
  - **Line 316-327:** Skips 2FA, sends user data to backend, calls `onLoggedIn()`
  
  **If 2FA Enabled but Not Configured:**
  - **Line 335-360:** Generates QR code and secret:
    ```typescript
    POST ${TWO_FA_BASE_URL}/2fa/generate
    ```
  - Shows QR code for user to scan
  
  **If 2FA Enabled and Configured:**
  - **Line 361-372:** Shows only OTP input field
  
  - **Line 374-394:** Saves 2FA state to sessionStorage for persistence

### Step 5: 2FA Verification (If Required)
**File:** `src/components/structures/auth/Login.tsx`
- **Line 618-658:** `on2FASubmit()` method:
  - **Line 621-631:** Verifies 2FA token:
    ```typescript
    POST ${TWO_FA_BASE_URL}/2fa/verify
    ```
  - **Line 645-654:** On success:
    - Clears 2FA state
    - Sends user data to backend
    - Calls `this.props.onLoggedIn(this.loginCreds!)`

### Step 6: Session Establishment
**File:** `src/components/structures/MatrixChat.tsx`
- **Line 2245:** Login component calls `onLoggedIn={this.onUserCompletedLoginFlow}`
- **Line 2125-2132:** `onUserCompletedLoginFlow()`:
  - **Line 2127:** Calls `Lifecycle.setLoggedIn(credentials)`
  - **Line 2128:** Calls `this.postLoginSetup()`

**File:** `src/Lifecycle.ts`
- **Line 659-674:** `setLoggedIn()` function:
  - **Line 660:** Sets `freshLogin = true`
  - **Line 661:** Stops old Matrix client
  - **Line 662-671:** Creates pickle key for encryption
  - **Line 673:** Calls `doSetLoggedIn()`

**File:** `src/Lifecycle.ts`
- **Line 725-818:** `doSetLoggedIn()` function - **Core session initialization**:
  - **Line 730:** Checks session lock
  - **Line 749-750:** Clears storage if needed
  - **Line 753:** Checks storage consistency
  - **Line 761:** Creates OIDC token refresher (if applicable)
  - **Line 765:** **Creates Matrix client:** `MatrixClientPeg.replaceUsingCreds()`
  - **Line 766:** Gets client instance
  - **Line 768:** Sets Sentry user
  - **Line 770-772:** Starts PostHog analytics
  - **Line 774-784:** Persists credentials to localStorage
  - **Line 789:** Fires `Action.OnLoggedIn` event
  - **Line 791-800:** Sets up crypto store options
  - **Line 803:** **Starts Matrix client:** `startMatrixClient()`
  - **Line 809:** Runs settings migrations
  - **Line 811-815:** Sets device verification flag for new users

**File:** `src/Lifecycle.ts`
- **Line 954-1020:** `startMatrixClient()` function:
  - **Line 965:** Dispatches `will_start_client` event
  - **Line 969:** Initializes global socket manager
  - **Line 972-987:** Starts various services:
    - TypingStore
    - ToastStore
    - Notifier
    - UserActivity
    - DMRoomMap
    - IntegrationManagers
    - ActiveWidgetStore
    - LegacyCallHandler
    - Mjolnir
  - **Line 993-994:** Initializes event index
  - **Line 994:** **Starts syncing:** `MatrixClientPeg.start()`
  - **Line 1003:** Starts DeviceListener
  - **Line 1006-1008:** Starts Presence (if not low bandwidth)
  - **Line 1011:** Starts Jitsi
  - **Line 1015:** Dispatches `client_started` event

**File:** `src/MatrixClientPeg.ts`
- **Line 227-229:** `replaceUsingCreds()` calls `createClient()`
- **Line 408-467:** `createClient()` method:
  - **Line 409-455:** Sets up client options
  - **Line 457:** **Creates client:** `createMatrixClient(opts)`

**File:** `src/utils/createMatrixClient.ts`
- **Line 40-113:** `createMatrixClient()` function:
  - **Line 45-54:** Sets up IndexedDB or Memory store
  - **Line 56-62:** Sets up crypto store
  - **Line 64:** **Creates Matrix client:** `createClient()` from matrix-js-sdk
  - **Line 81-110:** Wraps delayed event handler for error handling
  - Returns configured MatrixClient instance

**File:** `src/MatrixClientPeg.ts`
- **Line 364-370:** `start()` method:
  - **Line 365:** Calls `assign()` to initialize stores and crypto
  - **Line 368:** **Starts client syncing:** `this.matrixClient!.startClient(opts)`

### Step 7: Post-Login Setup
**File:** `src/components/structures/MatrixChat.tsx`
- **Line 390-445:** `postLoginSetup()` method:
  - **Line 397:** Waits for first sync
  - **Line 399-407:** Checks cross-signing setup
  - **Line 412:** Sets `pendingInitialSync` state
  - **Line 421-430:** Shows security setup if cross-signing exists
  - **Line 431-443:** Starts E2E setup if needed
  - **Line 442:** Calls `this.onLoggedIn()` when complete

**File:** `src/components/structures/MatrixChat.tsx`
- **Line 1462-1468:** `onLoggedIn()` method:
  - **Line 1463:** Sets theme
  - **Line 1465:** Tries to persist storage
  - **Line 1467:** Calls `onShowPostLoginScreen()`

**File:** `src/components/structures/MatrixChat.tsx`
- **Line 1470-1524:** `onShowPostLoginScreen()` method:
  - **Line 1471:** Sets view to `LOGGED_IN`
  - **Line 1474-1495:** Shows appropriate screen (homepage, room, etc.)
  - **Line 1497-1523:** Shows mobile guide toast and user notices

---

## Alternative Authentication Flows

### SSO/Token Login
**File:** `src/Lifecycle.ts`
- **Line 364-411:** `attemptTokenLogin()` function:
  - Checks for `loginToken` in query params
  - Calls `sendLoginRequest()` with token
  - On success: calls `onSuccessfulDelegatedAuthLogin()`
  - On failure: shows error dialog

### OIDC Native Flow
**File:** `src/Lifecycle.ts`
- **Line 292-324:** `attemptOidcNativeLogin()` function:
  - **Line 294-295:** Completes OIDC login flow
  - **Line 297-301:** Gets user info from access token
  - **Line 303-311:** Creates credentials object
  - **Line 314:** Calls `onSuccessfulDelegatedAuthLogin()`

**File:** `src/Lifecycle.ts`
- **Line 418-424:** `onSuccessfulDelegatedAuthLogin()` function:
  - Clears storage
  - Persists credentials
  - Sets `mx_fresh_login` flag

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `src/components/structures/MatrixChat.tsx` | Main app component, session initialization entry point |
| `src/components/structures/auth/Login.tsx` | Login UI component, handles 2FA integration |
| `src/components/views/auth/PasswordLogin.tsx` | Password login form component |
| `src/Login.ts` | Login logic, API calls to Matrix server |
| `src/Lifecycle.ts` | Session lifecycle management, client startup |
| `src/MatrixClientPeg.ts` | Matrix client creation and management |
| `src/utils/createMatrixClient.ts` | Matrix client factory function |

---

## Session Storage

### Credentials Stored
- `mx_user_id` - User ID
- `mx_access_token` - Encrypted access token
- `mx_refresh_token` - Encrypted refresh token (if OIDC)
- `mx_is_guest` - Guest flag
- `mx_has_pickle_key` - Encryption key flag
- Homeserver and Identity Server URLs

### 2FA State (SessionStorage)
- `mx_2fa_state` - 2FA configuration state
- `mx_2fa_creds` - Temporary login credentials during 2FA flow

---

## Error Handling

- **Login failures:** Displayed in Login component state
- **Session lock conflicts:** Shows lock stolen view
- **Storage inconsistencies:** Shows error dialog recommending reset
- **2FA verification failures:** Shows error message, allows retry

---

## Notes

1. **Email login is disabled** - Only username and phone login are supported
2. **Custom 2FA implementation** - Uses external API (`TWO_FA_BASE_URL`) rather than Matrix-native 2FA
3. **Username formatting** - Automatically formats as `@username:ms.beep.gov.pk`
4. **Session persistence** - Credentials are encrypted and stored in localStorage
5. **Multiple auth methods** - Supports password, SSO token, and OIDC flows
