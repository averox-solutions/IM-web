# Issues Found in Element Call Widget Integration

## 1. Circular Dependency Issue
**Error**: `ReferenceError: Cannot access 'B' before initialization`

**Location**: 
- `src/stores/WidgetStore.ts` (line 38-42) - starts immediately
- `src/stores/widgets/WidgetMessagingStore.ts` (line 29-33) - starts immediately  
- `src/stores/ActiveWidgetStore.ts` (line 13) - imports WidgetMessagingStore
- `src/stores/WidgetStore.ts` (line 17) - imports ActiveWidgetStore

**Problem**: 
- `WidgetStore` and `WidgetMessagingStore` both start immediately in static initialization
- `WidgetStore` imports `ActiveWidgetStore`
- `ActiveWidgetStore` imports `WidgetMessagingStore`
- This creates a circular dependency during module initialization

**Solution**: 
- Defer the `start()` call in `WidgetStore` and `WidgetMessagingStore` until after all modules are loaded
- Use lazy initialization pattern similar to `WidgetLayoutStore` (which uses `setTimeout` to defer WidgetStore access)

## 2. Delayed Event Update Failure
**Error**: `error updating delayed event: Error: Failed to override function`

**Location**: 
- `src/stores/widgets/StopGapWidgetDriver.ts` (line 415)
- Called from Matrix SDK: `client._unstable_updateDelayedEvent(delayId, action)`

**Problem**:
- The delayed event (Futures/MSC4140) update is failing with "Failed to override function"
- This happens when trying to update a delayed event after the widget/session has been partially destroyed
- The MembershipManager retries 10 times and then shuts down

**Root Cause**:
- Widget cleanup happens too early, before delayed events complete
- The delayed event update mechanism tries to override a function that's already been cleaned up

**Current Fix Applied**:
- Increased cleanup delay to 1500ms before clearing widgets
- Stop messaging transport before clearing widgets
- Wait for delayed events to complete before destroying widgets

## 3. Unknown Widget Action Error
**Error**: `Failed to send join action p9: Unknown or unsupported action: io.element.join`

**Location**:
- `src/models/Call.ts` (line 867) - `ElementWidgetActions.JoinCall`

**Problem**:
- Widget doesn't recognize the `io.element.join` action
- This happens when the widget isn't fully loaded or the messaging transport isn't ready

**Current Fix Applied**:
- Added check to wait for transport to be ready before sending join action
- Gracefully handle "Unknown action" errors without failing completely

## 4. MembershipManager Shutdown
**Error**: `MembershipManager shut down because of the end condition: Error: Reached maximum (10) retries cause by: p9: Error updating delayed event`

**Location**:
- Matrix SDK's MembershipManager (internal to matrix-js-sdk)

**Problem**:
- MembershipManager tries to update delayed events
- After 10 failed retries, it shuts down completely
- This breaks the call functionality

**Root Cause**:
- Delayed event updates are failing (see issue #2)
- The retry mechanism exhausts all attempts

**Current Fix Applied**:
- Improved cleanup sequence to ensure delayed events complete
- Longer delays to allow MembershipManager to finish processing
- Better error handling to prevent cascading failures

## 5. Widget Initialization Order
**Issue**: Widget stores are initialized in the wrong order

**Problem**:
- `WidgetStore` starts immediately when module loads
- `WidgetMessagingStore` starts immediately when module loads
- `ActiveWidgetStore` is a singleton but doesn't start automatically
- This can cause race conditions

**Recommendation**:
- All widget stores should start in `Lifecycle.ts` `startMatrixClient()` function
- Use explicit initialization order instead of static initialization
- This is already partially done (ActiveWidgetStore.instance.start() is called in Lifecycle.ts line 980)

## Recommended Fixes

### Priority 1: Fix Circular Dependency
1. Defer `WidgetStore.start()` and `WidgetMessagingStore.start()` calls
2. Move initialization to `Lifecycle.ts` with explicit order
3. Use lazy getters similar to `WidgetLayoutStore`

### Priority 2: Improve Delayed Event Handling
1. Add timeout/retry logic for delayed event updates
2. Check if delayed event is still valid before updating
3. Add better error messages to identify which delayed event is failing

### Priority 3: Widget Action Handling
1. Add action capability checking before sending actions
2. Implement action registration/validation
3. Add fallback mechanisms for unsupported actions

## Files Modified
- `src/models/Call.ts` - Improved cleanup sequence and error handling

## Files That Need Modification
- `src/stores/WidgetStore.ts` - Defer start() call
- `src/stores/widgets/WidgetMessagingStore.ts` - Defer start() call  
- `src/Lifecycle.ts` - Add explicit widget store initialization order
- `src/stores/widgets/StopGapWidgetDriver.ts` - Add delayed event validation

