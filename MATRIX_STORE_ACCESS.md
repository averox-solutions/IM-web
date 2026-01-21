# Accessing Matrix Store Before Session Starts

## Answer: **Yes, but with important caveats**

You can access the Matrix store object before the session fully starts, but you need to understand the initialization timeline and wait for the store to be ready.

---

## Store Creation Timeline

### 1. Store Object Created
**Location:** `src/utils/createMatrixClient.ts:46`
- The store object is **created** when `createMatrixClient()` is called
- This happens in `MatrixClientPeg.createClient()` → `replaceUsingCreds()`
- **Timing:** Called in `Lifecycle.doSetLoggedIn()` at **line 765**

```typescript
// Store is created here
MatrixClientPeg.replaceUsingCreds(credentials, tokenRefresher?.doRefreshAccessToken.bind(tokenRefresher));
const client = MatrixClientPeg.safeGet();
// At this point: client.store exists, but is NOT initialized
```

### 2. Store Initialization
**Location:** `src/MatrixClientPeg.ts:271`
- The store is **initialized** when `store.startup()` is called
- This happens in `MatrixClientPeg.assign()` or `MatrixClientPeg.start()`
- **Timing:** Called in `Lifecycle.startMatrixClient()` at **line 994** or **line 997**

```typescript
// Store initialization happens here
const promise = this.matrixClient.store.startup();
await promise; // Wait for store to be ready
```

### 3. Session Fully Started
**Location:** `src/Lifecycle.ts:1015`
- Session is considered "started" after `startMatrixClient()` completes
- Dispatches `client_started` event

---

## Access Patterns

### ✅ **Safe: Access After Store Initialization**

```typescript
// Wait for store to be initialized
await MatrixClientPeg.assign();
const client = MatrixClientPeg.get();
if (client) {
    // Store is now ready to use
    const rooms = client.getRooms();
    const users = client.getUsers();
    // etc.
}
```

### ⚠️ **Risky: Access Before Initialization**

```typescript
// Store object exists but may not be ready
const client = MatrixClientPeg.get();
if (client && client.store) {
    // ⚠️ Store exists but startup() may not have completed
    // Some operations may fail or return incomplete data
    // You need to check if store is ready
}
```

### 🔍 **Check Store Readiness**

The Matrix store has a `startup()` method that returns a Promise. You can check if it's ready:

```typescript
const client = MatrixClientPeg.get();
if (client?.store) {
    // Check if store is already initialized
    // Note: There's no direct "isReady" flag, but you can:
    // 1. Wait for startup() promise if it exists
    // 2. Check if store methods work (they may throw if not ready)
    // 3. Listen for store events
}
```

---

## Direct IndexedDB Access (Alternative)

If you need to access data **before** the Matrix client is created, you can access IndexedDB directly:

### Matrix Store Database
- **Database Name:** `"riot-web-sync"`
- **Location:** Created by `IndexedDBStore` from matrix-js-sdk

### Direct Access Example

```typescript
import { getIDBFactory } from "./utils/StorageAccess";
import { IndexedDBStore } from "matrix-js-sdk/src/matrix";

// Check if store exists
const idbFactory = getIDBFactory();
if (idbFactory) {
    const exists = await IndexedDBStore.exists(idbFactory, "riot-web-sync");
    if (exists) {
        // Store database exists, but accessing it directly is complex
        // You'd need to understand the internal schema
    }
}
```

**⚠️ Warning:** Direct IndexedDB access is **not recommended** because:
1. The schema is internal to matrix-js-sdk
2. Data may be encrypted or in a specific format
3. Schema changes could break your code
4. You'd need to replicate store logic

---

## Recommended Approach

### Option 1: Wait for Store Initialization

```typescript
import MatrixClientPeg from "./MatrixClientPeg";

async function accessStore() {
    // Wait for client to be assigned (store initialized)
    const client = MatrixClientPeg.get();
    if (!client) {
        // Client not created yet
        return;
    }
    
    // If you're not sure if store is ready, you can:
    // 1. Wait for the client_started event
    // 2. Or ensure you're called after startMatrixClient() completes
    
    // Now safe to use
    const rooms = client.getRooms();
    const store = client.store;
    // Use store methods...
}
```

### Option 2: Listen for Client Events

```typescript
import { dis } from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";

dis.register((payload) => {
    if (payload.action === Action.ClientStarted) {
        // Client and store are now fully initialized
        const client = MatrixClientPeg.get();
        if (client) {
            // Safe to access store
            const rooms = client.getRooms();
        }
    }
});
```

### Option 3: Access During Session Restore

If you need early access, you can hook into the session restore flow:

```typescript
// In Lifecycle.ts or similar
async function restoreSessionFromStorage() {
    // ... restore logic ...
    
    // Before calling doSetLoggedIn, you could:
    // 1. Check if store database exists
    // 2. Access IndexedDB directly (risky)
    // 3. Wait for client creation
    
    await doSetLoggedIn(credentials, false, false);
    // After this, store is created but not initialized
    
    // After startMatrixClient(), store is initialized
}
```

---

## Store Access Points in Codebase

### When Store is Created
- **File:** `src/Lifecycle.ts:765`
- **Function:** `doSetLoggedIn()`
- **Line:** `MatrixClientPeg.replaceUsingCreds()`

### When Store is Initialized
- **File:** `src/MatrixClientPeg.ts:271`
- **Function:** `assign()`
- **Line:** `this.matrixClient.store.startup()`

### When Session Starts
- **File:** `src/Lifecycle.ts:1015`
- **Function:** `startMatrixClient()`
- **Event:** `Action.ClientStarted` dispatched

---

## Key Points

1. **Store object exists** after `replaceUsingCreds()` is called (line 765)
2. **Store is initialized** after `assign()` completes (line 271)
3. **Session is started** after `startMatrixClient()` completes (line 1015)
4. **Safe access:** Wait for `client_started` event or ensure `assign()` has completed
5. **Direct IndexedDB:** Possible but not recommended due to schema complexity

---

## Example: Safe Store Access Pattern

```typescript
import MatrixClientPeg from "./MatrixClientPeg";
import { dis } from "./dispatcher/dispatcher";
import { Action } from "./dispatcher/actions";

class MyStoreAccessor {
    private clientReady = false;
    
    constructor() {
        // Check if client already exists
        const existingClient = MatrixClientPeg.get();
        if (existingClient) {
            this.clientReady = true;
            this.accessStore();
        } else {
            // Wait for client to be created
            dis.register((payload) => {
                if (payload.action === Action.ClientStarted) {
                    this.clientReady = true;
                    this.accessStore();
                }
            });
        }
    }
    
    private accessStore() {
        const client = MatrixClientPeg.get();
        if (!client) return;
        
        // Store is now ready
        const rooms = client.getRooms();
        const store = client.store;
        
        // Use store methods safely
        // Note: Some store methods may still require sync to complete
        // for full data availability
    }
}
```

---

## Summary

**Can you access the Matrix store before session starts?**

- **Store object:** ✅ Yes, after `replaceUsingCreds()` (line 765)
- **Store initialized:** ⚠️ No, wait for `assign()` to complete (line 271)
- **Full session:** ⚠️ No, wait for `startMatrixClient()` to complete (line 1015)

**Best Practice:** Wait for the `client_started` event or ensure you're accessing the store after `MatrixClientPeg.assign()` has completed.
