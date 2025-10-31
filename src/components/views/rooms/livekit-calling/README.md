# LiveKit Calling Components

This directory contains the LiveKit calling implementation for Element with end-to-end encryption (E2EE) support.

## Overview

The LiveKit calling system provides:

- Real-time video and audio communication
- End-to-end encryption (E2EE) for secure calls
- React components for easy integration
- Test modes for E2EE validation
- **NEW: Automatic incoming call notifications** for room participants

## 🆕 New Calling Format with Auto-Notifications

### How It Works

The system now supports automatic incoming call notifications. When a user starts a call:

1. **Frontend gathers participant data** from Matrix room members
2. **Backend receives enhanced call data** with participant information
3. **Backend automatically sends notifications** to all online participants
4. **Recipients see incoming call modal** with accept/reject options
5. **All participants join with pre-provided tokens** (seamless experience)

### Updated Call Usage

```tsx
// NEW FORMAT - Automatically triggers notifications for room participants
<VideoRoom
    roomId="!pBwjTwVCSHvPMowYPr:ms.beep.gov.pk"    // Matrix room ID
    toUserIds={["@user1:server.com", "@user2:server.com"]}  // Users to call
    toUsernames={{"@user1:server.com": "Alice", "@user2:server.com": "Bob"}}
    isVideo={true}                                   // Video or voice call
    fromUsername="current_user"                      // Caller's username
    groupName="Team Meeting"                         // Optional group name
/>

// OLD FORMAT - Backward compatibility (no notifications)
<VideoRoom
    roomName="room-123"
    participantName="user123"
    testMode={{ useWrongKey: false }}
/>
```

### Backend Request Format

The backend now receives enhanced data for automatic notifications:

```json
{
    "roomId": "!pBwjTwVCSHvPMowYPr:ms.beep.gov.pk",
    "toUserIds": ["@user1:server.com", "@user2:server.com"],
    "toUsernames": {
        "@user1:server.com": "Alice",
        "@user2:server.com": "Bob"
    },
    "isVideo": true,
    "fromUsername": "current_user",
    "groupName": "Team Meeting"
}
```

### Integration Benefits

- ✅ **Zero additional API calls** for incoming participants
- ✅ **Automatic participant discovery** from Matrix room data
- ✅ **Real-time notifications** via existing socket infrastructure
- ✅ **Seamless user experience** with pre-authenticated tokens
- ✅ **Backward compatibility** with existing calling methods

## Components

### VideoRoom

The main component that handles LiveKit room connection and video/audio rendering.

```typescript
import { VideoRoom } from './livekit-calling';

<VideoRoom
  roomName="my-room"
  participantName="user123"
  testMode={{ useWrongKey: false }}
/>
```

### LiveKitCallingExample

A complete example component showing how to implement a calling interface.

```typescript
import { LiveKitCallingExample } from './livekit-calling';

<LiveKitCallingExample
  roomId="room-123"
  userId="user-456"
/>
```

### useRoom Hook

A custom hook for managing room connection and state.

```typescript
import { useRoom } from "./livekit-calling";

const { token, serverUrl, error, isConnecting, connect, roomOptions } = useRoom({
    roomName: "my-room",
    participantName: "user123",
    testMode: { useWrongKey: false },
});
```

## Configuration

### Environment Variables

Set these environment variables for your LiveKit server:

```bash
REACT_APP_LIVEKIT_API_URL=http://localhost:3001
REACT_APP_LIVEKIT_SERVER_URL=wss://your-livekit-server
```

### Backend Requirements

Your backend needs to provide these endpoints:

#### POST /create-room

Creates a room and returns connection details:

```json
{
    "token": "jwt-token",
    "serverUrl": "wss://livekit-server",
    "e2eeKey": "encryption-key"
}
```

## E2EE (End-to-End Encryption)

### How it works

1. Backend generates a unique E2EE key for each room
2. All participants must have the same key to decrypt media
3. Different keys result in black video/no audio (by design)

### Testing E2EE

Use the test modes to verify E2EE functionality:

```typescript
// Use wrong key to test encryption
testMode={{ useWrongKey: true }}

// Use custom key for testing
testMode={{ customKey: "my-test-key" }}
```

### Expected Behavior

- ✅ Same key = participants can see/hear each other
- ❌ Different key = black video/no audio
- 🔒 All tracks show as encrypted regardless of key correctness

## File Structure

```
livekit-calling/
├── VideoRoom.tsx           # Main video room component
├── LiveKitCallingExample.tsx # Example implementation
├── hooks/
│   └── useRoom.ts          # Room connection hook
├── workers/
│   ├── e2ee.worker.ts      # E2EE worker implementation
│   └── e2ee.worker.types.ts # TypeScript declarations
├── config/
│   └── index.ts            # Configuration constants
├── index.ts                # Main exports
└── README.md               # This file
```

## Dependencies

Required packages:

- `livekit-client` (already installed)
- `@livekit/components-react` (installed)
- `@livekit/components-styles` (installed)

## Usage Example

```typescript
import React from 'react';
import { LiveKitCallingExample } from './components/views/rooms/livekit-calling';

function MyApp() {
  return (
    <div>
      <h1>My Video Calling App</h1>
      <LiveKitCallingExample
        roomId="meeting-room-123"
        userId="john-doe"
      />
    </div>
  );
}
```

## Debugging

### Console Logs

The components provide detailed console logging:

- Connection status
- E2EE status and verification
- Track encryption status
- Decryption errors

### Common Issues

1. **Black video/no audio**: Check E2EE keys match
2. **Connection failed**: Verify server URL and token
3. **Worker errors**: Check E2EE worker loading

### E2EE Verification

Monitor console for these messages:

- `E2EE enabled successfully`
- `Track encryption status`
- `Possible decryption failure` (indicates key mismatch)

## Integration with Element

To integrate with the existing Element codebase:

1. Import the components where needed
2. Configure your backend to provide LiveKit tokens and E2EE keys
3. Use the components in your room views
4. Handle room state and user permissions as needed

## Next Steps

1. Set up your LiveKit server
2. Implement the backend endpoints
3. Configure environment variables
4. Test E2EE functionality
5. Integrate with your existing UI

For more information, see the [LiveKit documentation](https://docs.livekit.io).

# LiveKit Calling Integration for Element Web

A modern LiveKit-based calling system designed to gradually replace the existing MediaSoup backend in Element Web.

## Overview

This implementation provides:

- LiveKit-based video and voice calling
- End-to-End Encryption (E2EE) support
- Incoming and outgoing call handling
- Socket-based real-time communication
- Modern React components with TypeScript

## Directory Structure

```
src/components/views/rooms/livekit-calling/
├── hooks/
│   └── useRoom.ts                    # Room connection management
├── workers/
│   ├── e2ee.worker.ts               # E2EE worker implementation
│   └── e2ee.worker.types.ts         # TypeScript declarations
├── config/
│   └── index.ts                     # Environment configuration
├── components/
│   ├── VideoRoom.tsx                # Main LiveKit room component
│   ├── IncomingLiveKitCallModal.tsx # Incoming call notification
│   ├── LiveKitRoomManager.tsx       # Call state management
│   └── LiveKitCallingExample.tsx    # Demo implementation
└── README.md                        # This documentation
```

## Features

### ✅ Implemented

- LiveKit room creation and connection
- Video/audio track management with deduplication
- E2EE status monitoring and logging
- Socket-based communication with backend
- Incoming call notifications with accept/reject
- Call state management (incoming/outgoing)
- Auto-connection timeout and error handling
- Comprehensive logging and debugging tools

### 🔧 In Progress

- Full E2EE functionality (pending LiveKit client exports)
- Backend integration for call acceptance/rejection
- Call logs and history
- Advanced call controls (mute, camera toggle)

## Usage Guide

### Setting Up Environment Variables

```bash
# Required for LiveKit connection
REACT_APP_LIVEKIT_API_URL=http://localhost:3000
REACT_APP_LIVEKIT_SERVER_URL=ws://localhost:7880

# Your LiveKit server configuration
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

### Basic Implementation

```tsx
import { VideoRoom } from './livekit-calling/VideoRoom';

// For outgoing calls (initiated by user)
<VideoRoom
    roomName="room-12345"
    participantName="user@example.com"
    testMode={{
        useWrongKey: false,
        customKey: undefined,
    }}
/>

// For incoming calls (using provided token)
<LiveKitRoomManager
    callData={{
        roomId: "room-12345",
        participantName: "user@example.com",
        token: "jwt_token_from_backend",
        serverUrl: "wss://livekit.example.com",
        e2eeKey: "encryption_key",
        callType: "video", // or "voice"
        isIncoming: true,
    }}
    isActive={true}
    onClose={() => setCallActive(false)}
/>
```

## NEW: Incoming Call Flow with Automatic Notifications

### Updated Call Initiation

The system now supports two calling formats:

#### 1. New Format (Triggers Incoming Call Notifications)

When starting a call using the new format, the system automatically sends incoming call notifications to other participants:

```tsx
// Use VideoRoom with new format - triggers notifications for other users
<VideoRoom
    roomId="!pBwjTwVCSHvPMowYPr:ms.beep.gov.pk" // Matrix room ID
    toUserIds={["@user1:server.com", "@user2:server.com"]} // Array of users to call
    toUsernames={{
        // Username mapping
        "@user1:server.com": "Alice",
        "@user2:server.com": "Bob",
    }}
    isVideo={true} // Video call or voice call
    fromUsername="current_user" // Caller's username
    groupName="Team Meeting" // Optional group name
/>
```

#### 2. Old Format (Backward Compatibility)

```tsx
// Old format - for testing or when notifications aren't needed
<VideoRoom roomName="room-123" participantName="user123" testMode={{ useWrongKey: false }} />
```

### How the New Format Works

1. **User clicks call button** in RoomHeader
2. **System gathers participant data** from Matrix room members
3. **Backend receives create-room request** with proper format:
    ```json
    {
        "roomId": "!pBwjTwVCSHvPMowYPr:ms.beep.gov.pk",
        "toUserIds": ["@user1:server.com", "@user2:server.com"],
        "toUsernames": {
            "@user1:server.com": "Alice",
            "@user2:server.com": "Bob"
        },
        "isVideo": true,
        "fromUsername": "current_user",
        "groupName": "Team Meeting"
    }
    ```
4. **Backend automatically sends incoming_call events** to all online participants
5. **Recipients see incoming call modal** with accept/reject options
6. **Participants join using pre-provided tokens** (no additional API calls needed)

### Backend Integration

Your backend must support both formats. When the new format is detected (`roomId` + `toUserIds` + `fromUsername`), it should:

1. Generate tokens for all participants
2. Send `incoming_call` socket events to each recipient
3. Include LiveKit token, serverUrl, and e2eeKey in the events

### Implementation in RoomHeader

The `RoomHeader` component now automatically:

- Gathers room member data when starting calls
- Uses the new calling format by default
- Handles both outgoing and incoming call scenarios
- Manages call state and UI updates

```typescript
// Example of gathered participant data
const participantData = {
    roomId: "!pBwjTwVCSHvPMowYPr:ms.beep.gov.pk",
    toUserIds: ["@user1:server.com", "@user2:server.com"],
    toUsernames: {
        "@user1:server.com": "Alice",
        "@user2:server.com": "Bob",
    },
    fromUsername: "current_user",
    groupName: isGroupCall ? roomName : null,
};
```

### Testing the Flow

1. **Start a call** by clicking video/voice button in room header
2. **Check console logs** for participant data gathering
3. **Verify backend receives** new format data
4. **Confirm other users receive** incoming call notifications
5. **Test acceptance/rejection** of incoming calls

## Updated Calling Flow

### 1. Call Initiation (NEW)

```typescript
// User clicks call button → RoomHeader gathers participant data → Sends new format to backend
const participantData = gatherParticipantData(); // Gets room members
GroupCallVideo(); // → VideoRoom with roomId, toUserIds, etc.
```

### 2. Backend Processing (UPDATED)

```javascript
// Backend detects new format → Generates tokens for all participants → Sends notifications
if (roomId && toUserIds && fromUsername) {
    // NEW: Send incoming_call events to all recipients
    for (const toUserId of toUserIds) {
        SocketIO.io.to(recipientSocketId).emit("incoming_call", {
            roomId,
            fromUserId,
            fromUsername,
            isVideo,
            participants,
            token: recipientJwt,
            serverUrl: LIVEKIT_URL,
            e2eeKey,
        });
    }
}
```

### 3. Incoming Call Handling (EXISTING)

```typescript
// Recipients receive socket event → Show modal → Accept/reject → Join room
window.addEventListener("incomingLiveKitCall", handleIncomingCall);
// → IncomingLiveKitCallModal → LiveKitRoomManager → Join with token
```

This new flow ensures that when someone starts a call, all room participants automatically receive incoming call notifications and can join seamlessly.

## Usage Example

## Dependencies

### Required Packages

```json
{
    "@livekit/components-react": "^2.9.9",
    "@livekit/components-styles": "^1.1.4",
    "livekit-client": "^2.13.3",
    "socket.io-client": "^4.x.x"
}
```

### Styling

Import LiveKit component styles:

```tsx
import "@livekit/components-styles";
```

## API Integration

### Backend Requirements

Your LiveKit backend API should:

1. Generate JWT tokens for each participant
2. Provide LiveKit server URLs
3. Generate/distribute E2EE keys
4. Send socket events with all required data

### Required Socket Events

```typescript
// Incoming call event
socket.emit("incoming_call", {
    roomId: string,
    fromUserId: string,
    fromUsername: string,
    isVideo: boolean,
    participants: object,
    isGroup: boolean,
    groupName?: string,
    callLogId: string,
    token: string,      // LiveKit JWT token
    serverUrl: string,  // LiveKit WebSocket URL
    e2eeKey?: string,   // E2EE encryption key
});

// Call acceptance/rejection events (to be implemented)
socket.emit("call_accepted", { roomId, participantId });
socket.emit("call_rejected", { roomId, participantId });
```

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check LiveKit server URL and JWT token validity
2. **E2EE Issues**: Verify that all participants have the same E2EE key
3. **Socket Disconnections**: Ensure stable WebSocket connection to backend
4. **Import Errors**: Update to compatible LiveKit client version

### Debugging

Enable comprehensive logging:

```typescript
// Set up debugging in your component
console.log("LiveKit Debug Info:", {
    token: token?.substring(0, 20) + "...",
    serverUrl,
    roomOptions,
    isE2EEEnabled: room?.isE2EEEnabled,
});
```

### Performance Monitoring

Monitor track deduplication and participant management:

```typescript
console.log("Track debugging:", {
    totalParticipants: participants.length,
    totalTracks: allTracks.length,
    uniqueTracks: uniqueTracks.length,
});
```

## Migration from MediaSoup

This LiveKit implementation is designed to gradually replace the existing MediaSoup calling system:

1. **Phase 1**: Implement LiveKit alongside MediaSoup ✅
2. **Phase 2**: Add feature flag to switch between systems
3. **Phase 3**: Migrate users progressively
4. **Phase 4**: Remove MediaSoup code

## Contributing

When contributing to this codebase:

1. Follow existing TypeScript patterns
2. Add comprehensive error handling
3. Include console logging for debugging
4. Update this documentation for new features
5. Test both incoming and outgoing call scenarios

## Support

For issues related to:

- **LiveKit Integration**: Check LiveKit documentation
- **Socket Communication**: Verify backend API implementation
- **E2EE**: Ensure proper key distribution
- **React Components**: Follow Element Web component patterns
