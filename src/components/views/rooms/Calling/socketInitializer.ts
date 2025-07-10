import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { Socket } from "socket.io-client";
import store from "./redux/store";
import { setCallRoom, setCallInfo } from "./redux/callReducer";
import GlobalSocketManager from "./GlobalSocketManager";

/**
 * Get the global socket instance (no longer creates separate socket)
 * @returns The global socket instance or null if not available
 */
export function initializeSocketIfNeeded(): Socket | null {
    const matrixClient = MatrixClientPeg.get();

    if (!matrixClient) {
        console.warn("No Matrix client available, cannot get socket");
        return null;
    }

    const userId = matrixClient.getUserId();

    if (!userId) {
        console.warn("No user ID available, cannot get socket");
        return null;
    }

    // Get the global socket instead of creating a new one
    const globalSocket = GlobalSocketManager.getGlobalSocket();

    if (!globalSocket) {
        console.warn("Global socket not available yet, make sure GlobalSocketManager is initialized");
        return null;
    }

    console.log("✅ Using global socket connection for user:", userId);

    // Set up legacy incoming call event listener if not already set
    if (!(window as any).__legacyCallListenerSet) {
        window.addEventListener("incomingCall", (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail) {
                const { roomId, fromUserId, fromUsername, isVideo, participants, isGroup, groupName, callLogId } =
                    customEvent.detail;

                // Log the incoming call details
                console.log("📞 Legacy: Received incoming call event:", customEvent.detail);

                // Update Redux state for legacy MediaSoup calls
                store.dispatch(
                    setCallRoom({
                        roomId: roomId,
                        userId: fromUserId,
                        username: fromUsername,
                        isVideo: isVideo,
                        isIncoming: true,
                        participants: participants,
                        callLogId: callLogId,
                    }),
                );

                store.dispatch(
                    setCallInfo({
                        callerInfo: {
                            username: fromUsername,
                            isGroupCall: isGroup,
                            groupName: groupName,
                        },
                        callLogId: callLogId,
                    }),
                );
            }
        });

        (window as any).__legacyCallListenerSet = true;
        console.log("✅ Set up legacy incoming call event listener");
    }

    return globalSocket;
}

/**
 * Get the global socket instance
 */
export function getSocket(): Socket | null {
    return GlobalSocketManager.getGlobalSocket();
}

/**
 * Disconnect is handled by GlobalSocketManager
 */
export function disconnectSocket(): void {
    console.log("🔄 Disconnect handled by GlobalSocketManager - no action needed");
}

export default {
    initializeSocketIfNeeded,
    disconnectSocket,
    getSocket,
};
