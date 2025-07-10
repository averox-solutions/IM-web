# Element Web Call Integration with Redux

This directory contains a socket implementation for Element Web with integrated Redux state management for calls.

## Files Overview

- **Socket Communication**
  - `socketEvents.ts` - Defines all the socket event constants
  - `socketService.ts` - Provides a service for socket connections and emitting events
  - `socketInitializer.ts` - Handles initialization and cleanup of socket connections
  - `SocketInitializer.tsx` - React component that initializes socket when app loads

- **Call Service**
  - `callService.ts` - Service for handling call-related operations using the socket

- **Utilities**
  - `notificationUtils.ts` - Utility functions for displaying notifications without external dependencies
  - `MatrixUtils.ts` - Helper functions for Matrix-specific operations

- **Redux State Management**
  - `redux/callReducer.ts` - Reducer for managing call state
  - `redux/rootReducer.ts` - Combines all reducers
  - `redux/store.ts` - Redux store configuration
  - `redux/hooks.ts` - Typed hooks for accessing Redux state
  - `redux/ReduxProvider.tsx` - Provider component for Redux store

- **React Components**
  - `CallProvider.tsx` - Main provider component that integrates everything
  - `components/CallUI.tsx` - UI for active calls
  - `components/MatrixCallButton.tsx` - Button to start calls in Matrix rooms

- **Custom Hooks**
  - `hooks/useCallState.ts` - Hook for accessing call state and actions

## Dependencies

You need to install the following dependencies:

```bash
npm install socket.io-client mediasoup-client @reduxjs/toolkit react-redux
```

## Integration Steps

1. **Wrap your application with the CallProvider**

   ```tsx
   import { CallProvider } from 'path/to/components/views/rooms/Calling';

   const App = () => {
     return (
       <CallProvider>
         {/* Your existing app content */}
       </CallProvider>
     );
   };
   ```

2. **Configure your backend URL**

   Set the backend URL in your environment configuration or directly in `socketService.ts`.

3. **Add call buttons to your rooms**

   ```tsx
   import { MatrixCallButton } from 'path/to/components/views/rooms/Calling';

   const RoomHeader = () => {
     return (
       <div className="room-header">
         <h1>Room Name</h1>
         <div className="room-actions">
           <MatrixCallButton isVideo={false} /> {/* Audio call */}
           <MatrixCallButton isVideo={true} />  {/* Video call */}
         </div>
       </div>
     );
   };
   ```

4. **Access call state in your components**

   ```tsx
   import { useCallState } from 'path/to/components/views/rooms/Calling';

   const MyComponent = () => {
     const { isOngoing, localStream, remoteStreams, endCall } = useCallState();
     
     if (isOngoing) {
       return (
         <div>
           <p>In a call</p>
           <button onClick={() => endCall(roomId)}>End Call</button>
         </div>
       );
     }
     
     return <p>Not in a call</p>;
   };
   ```

## Notifications

This implementation provides multiple ways to display notifications:

1. **Browser Notifications** - Using the Web Notifications API
2. **Custom Toast Notifications** - Simple DOM-based notifications
3. **Call Notifications** - Custom UI elements for incoming calls with accept/reject buttons

To show a simple toast notification:

```typescript
import { showToast } from 'path/to/components/views/rooms/Calling';

// Show a success toast
showToast('Operation successful', 'success');

// Show an error toast
showToast('Operation failed', 'error');
```

## Redux State Management

The implementation uses Redux Toolkit for state management. The main call state includes:

- `isOngoing` - Whether there's an active call
- `localStream` - The local media stream
- `remoteStreams` - Remote streams from other participants
- `producers` - MediaSoup producers
- `consumers` - MediaSoup consumers
- `participants` - Call participants
- `isIncoming` - Whether the call is incoming
- `roomId` - The ID of the room
- `callLogId` - The ID of the call log
- `callerInfo` - Information about the caller

You can access this state using the `useCallState` hook:

```typescript
import { useCallState } from 'path/to/components/views/rooms/Calling';

function MyComponent() {
  const { 
    isOngoing, 
    localStream, 
    startCall, 
    endCall, 
    acceptCall 
  } = useCallState();
  
  // Use the state and actions
}
```

## Customization

- Update the socket events in `socketEvents.ts` to match your backend
- Modify the `callService.ts` implementation to match your requirements
- Update `socketInitializer.ts` if you need different authentication logic
- Customize notification styles in `notificationUtils.ts`
- Extend the Redux store with additional reducers if needed