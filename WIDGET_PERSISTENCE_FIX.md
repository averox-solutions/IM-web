# Widget Persistence Fix - Element Call

## Issue
When switching between tabs/rooms, the Element Call widget was being destroyed, forcing users to rejoin the call.

## Root Cause
Element Call widgets were not being marked as "persistent", so when users navigated away from the room:
1. The widget iframe would be unmounted
2. The call connection would be lost
3. Users had to reconnect when returning

## Solution
Made Element Call widgets **automatically persistent** when a call starts.

### File Modified
`/src/models/Call.ts` - Lines 274-282

### Code Changes
```typescript
// Added after successful connection:
// Automatically make the widget persistent so it doesn't get destroyed when switching tabs
ActiveWidgetStore.instance.setWidgetPersistence(this.widget.id, this.roomId, true);
logger.log(`Set Element Call widget ${this.widget.id} as persistent`);
```

## How Persistence Works

### Before Fix:
1. User joins call → Widget loads
2. User switches to another room → Widget destroyed
3. User returns → Must rejoin call

### After Fix:
1. User joins call → Widget loads → **Marked as persistent**
2. User switches to another room → **Widget stays alive (moved to background)**
3. User returns → **Call still active, reconnects instantly**

## Technical Details

### ActiveWidgetStore
Element Web uses `ActiveWidgetStore` to track widget lifecycle:
- **Persistent widgets**: Stay alive even when not visible
- **Non-persistent widgets**: Destroyed when navigating away

### Persistence Methods:
```typescript
// Set widget as persistent
ActiveWidgetStore.instance.setWidgetPersistence(widgetId, roomId, true);

// Check if widget is persistent  
ActiveWidgetStore.instance.getWidgetPersistence(widgetId, roomId);

// Destroy persistent widget (when call ends)
ActiveWidgetStore.instance.destroyPersistentWidget(widgetId, roomId);
```

### Widget Lifecycle:
- Widget starts as **non-persistent**
- After successful call connection → **Made persistent**
- When call ends (via `destroy()`) → **Persistence removed**
- Widget iframe unmounts gracefully

## Testing

1. **Start a call** in any room
2. **Navigate to another room/tab**
3. **Return to the call room**

### Expected Behavior:
✅ Call remains active while navigating  
✅ No need to rejoin when returning  
✅ Audio/video stream continues uninterrupted  
✅ Widget reconnects instantly  

## Related Code

### Where Persistence is Granted:
- **Jitsi calls:** `StopGapWidgetDriver.ts:110` - Always granted
- **Element Call:** `StopGapWidgetDriver.ts:124` - Always granted (capability)
- **Our fix:** `Call.ts:279` - Automatically activated

### Where Persistence is Removed:
- `/src/models/Call.ts:943` - When call is destroyed
- `/src/stores/widgets/StopGapWidget.ts:479-486` - When widget stops (respects persistence)

## Benefits

1. **Better UX:** Users don't lose calls when navigating
2. **Seamless:** No interruption to ongoing conversations
3. **Expected behavior:** Matches how users expect video calls to work
4. **Multi-tasking:** Can browse other rooms while in a call

## Future Improvements

Could add user preference:
- Allow users to choose "pin call" vs "auto-close when leaving room"
- Add visual indicator for persistent widgets
- Allow manual persistence toggle via UI

---

**Status:** ✅ IMPLEMENTED & TESTED
**Build:** Successful
**Impact:** High (UX improvement)
