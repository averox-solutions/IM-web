import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { initializeSocketConnection } from "./initializeSocket";
import { Socket } from "socket.io-client";
import store from "./redux/store";
import { setCallRoom, setCallInfo } from "./redux/callReducer";

let socket: Socket | null = null;

/**
 * Initialize the socket connection when a user is logged in
 * @returns The socket instance or null if not initialized
 */
export function initializeSocketIfNeeded(): Socket | null {
    const matrixClient = MatrixClientPeg.get();
    
    if (!matrixClient) {
        console.warn("No Matrix client available, cannot initialize socket");
        return null;
    }
    
    const userId = matrixClient.getUserId();
    
    if (!userId) {
        console.warn("No user ID available, cannot initialize socket");
        return null;
    }
    
    if (!socket) {
        try {
            
            socket = initializeSocketConnection(userId);
            console.log("Socket connection initialized for user:", userId);
            
            // Set up event listener for the custom incomingCall event
            window.addEventListener('incomingCall', (event: Event) => {
                const customEvent = event as CustomEvent;
                if (customEvent.detail) {
                    const { 
                        roomId, 
                        fromUserId, 
                        fromUsername, 
                        isVideo, 
                        participants, 
                        isGroup, 
                        groupName, 
                        callLogId 
                    } = customEvent.detail;
                    
                    // Log the incoming call details
                    console.log('Received incoming call event:', customEvent.detail);
                    
                    // Update Redux state for incoming call
                    store.dispatch(
                        setCallRoom({
                            roomId: roomId,
                            userId: fromUserId,
                            username: fromUsername,
                            isVideo: isVideo,
                            isIncoming: true,
                            participants: participants,
                            callLogId: callLogId
                        })
                    );

                    store.dispatch(
                        setCallInfo({
                            callerInfo: {
                                username: fromUsername,
                                isGroupCall: isGroup,
                                groupName: groupName
                            },
                            callLogId: callLogId
                        })
                    );
                    
                    // Example: To accept a call programmatically
                    // const { roomId, isVideo } = customEvent.detail;
                    // acceptCall(roomId, isVideo);
                    
                    // Example: To reject a call programmatically
                    // const { roomId, callLogId } = customEvent.detail;
                    // rejectCall(roomId, callLogId);
                }
            });
            
        } catch (error) {
            console.error("Error initializing socket connection:", error);
            return null;
        }
    }
    
    return socket;
}

/**
 * Disconnect and clean up the socket connection
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log("Socket disconnected");
        
        // Remove event listeners
        window.removeEventListener('incomingCall', () => {});
    }
}

export function getSocket(): Socket | null {
    return socket;
}

export default {
    initializeSocketIfNeeded,
    disconnectSocket,
    getSocket
}; 