/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Socket } from "socket.io-client";
import SocketService from "./socketService";
import * as events from "./socketEvents";
import { showToast } from "./notificationUtils";
import store from "./redux/store";
import { setCallRoom, setCallInfo, removeRemoteStream, resetCallState } from "./redux/callReducer";

/**
 * Show a browser notification
 * @param title - The notification title
 * @param options - The notification options
 * @returns The notification object
 */
function showNotification(title: string, options?: NotificationOptions): Notification | null {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notifications");
        return null;
    }

    // Check if permission is already granted
    if (Notification.permission === "granted") {
        return new Notification(title, options);
    }
    // Otherwise, request permission
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                return new Notification(title, options);
            }
        });
    }

    return null;
}

/**
 * Initialize socket connection and event listeners
 * @param userId - The user ID to identify the connection
 * @returns The socket instance
 */
export function initializeSocketConnection(userId: string): Socket {
    const socket = SocketService.initialize(userId);
    console.log("socket came after initialize", socket);

    // Set up notification for connection issues
    socket.on(events.CONNECT_ERROR, (error) => {
        console.error("Socket connection error:", error);
        // Try browser notification first
        const notification = showNotification("Connection Error", {
            body: "Failed to connect to chat server",
            icon: "/favicon.ico",
        });

        // Fall back to toast notification if browser notification fails
        if (!notification) {
            showToast("Failed to connect to chat server", "error");
        }
    });

    // Handle incoming call with LiveKit support
    socket.on(
        events.INCOMING_CALL,
        async ({
            roomId,
            fromUserId,
            fromUsername,
            isVideo,
            participants,
            isGroup,
            groupName,
            callLogId,
            // LiveKit specific data
            token,
            serverUrl,
            e2eeKey,
        }) => {
            console.log("📞 Received incoming call:", {
                roomId,
                fromUserId,
                fromUsername,
                isVideo,
                isGroup,
                isLiveKitCall: !!(token && serverUrl), // Detect if this is a LiveKit call
                hasToken: !!token,
                hasServerUrl: !!serverUrl,
                hasE2eeKey: !!e2eeKey,
            });

            // Check if user is already in an active call - ignore new incoming calls
            const isUserInActiveCall = (): boolean => {
                // Check global call active state first (most reliable)
                if ((window as any).getCallActiveState && (window as any).getCallActiveState()) {
                    return true;
                }

                // Fallback to DOM checks
                // Check for active LiveKit call modals
                const hasLiveKitModal =
                    document.querySelector(".mx_LiveKitCall_active") ||
                    document.body.classList.contains("mx_LiveKitCall_active");

                // Check for active MediaSoup call modal
                const hasMediaSoupModal =
                    document.querySelector(".mx_CallModal") || document.querySelector('[data-testid="call-modal"]');

                // Check for any active call UI components
                const hasActiveCallUI =
                    document.querySelector(".lk-video-grid") || document.querySelector(".mx_CallView");

                return !!(hasLiveKitModal || hasMediaSoupModal || hasActiveCallUI);
            };

            if (isUserInActiveCall()) {
                console.log("🚫 Ignoring incoming call - user is already in an active call:", {
                    roomId,
                    fromUsername,
                    isVideo,
                    isGroup,
                    reason: "User already in call",
                    hasToken: !!token,
                    hasServerUrl: !!serverUrl,
                    timestamp: new Date().toISOString(),
                });

                // TODO: Send a "busy" response to the backend to notify the caller
                // This would help the caller know that the user is busy instead of just timing out
                // Example: socket.emit(events.CALL_BUSY, { roomId, fromUserId, reason: "user_busy" });

                return; // Ignore this incoming call
            }

            // Check if this is a LiveKit call (has token and serverUrl)
            const isLiveKitCall = !!(token && serverUrl);

            if (!isLiveKitCall) {
                // This is a legacy MediaSoup call - handle with old system
                console.log("📞 Handling as MediaSoup call (no LiveKit token)");

                // Transform participants array into object with IDs as keys
                const participantsObject = Array.isArray(participants)
                    ? participants.reduce((acc, participant) => {
                          acc[participant.id] = participant;
                          return acc;
                      }, {})
                    : participants;

                // Update Redux state for MediaSoup calls only
                store.dispatch(
                    setCallRoom({
                        roomId: roomId,
                        userId: fromUserId,
                        username: fromUsername,
                        isVideo: isVideo,
                        isIncoming: true,
                        participants: participantsObject,
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

                // Set up MediaSoup call event listeners
                socket.on(events.CALL_DECLINED, async ({ roomId: declinedRoomId, declinedBy }) => {
                    console.log("MediaSoup call declined event received", roomId, declinedRoomId);
                    if (roomId === declinedRoomId) {
                        const participants = store.getState().call.participants;
                        const username = participants[declinedBy]?.username || "User";
                        showToast(`${username} declined the call`, "info");
                        // Clean up call state
                        store.dispatch(resetCallState());
                    }
                });

                // Show browser notification for MediaSoup call
                const callType = isVideo ? "Video" : "Voice";
                const caller = isGroup ? groupName : fromUsername;

                const notification = showNotification(`Incoming ${callType} Call`, {
                    body: `${caller} is calling you via MediaSoup`,
                    icon: "/favicon.ico",
                    requireInteraction: true,
                });

                if (notification) {
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                        console.log("MediaSoup call notification clicked");
                    };
                }

                console.log("✅ MediaSoup call handled with Redux state update");
                return; // Don't process as LiveKit call
            }

            // This is a LiveKit call - handle with new system
            console.log("🚀 Handling as LiveKit call (token provided)");

            // Don't update Redux state for LiveKit calls to prevent old modal from showing
            // The LiveKit system uses custom events instead

            // Don't show old browser notifications for LiveKit calls - our professional system handles this
            console.log("📞 Skipping old browser notification for LiveKit call - using professional system");

            // Dispatch a custom event that the UI can listen for with LiveKit data
            const callEvent = new CustomEvent("incomingLiveKitCall", {
                detail: {
                    roomId,
                    fromUserId,
                    fromUsername,
                    isVideo,
                    participants,
                    isGroup,
                    groupName,
                    callLogId,
                    // LiveKit specific data for joining the call
                    token,
                    serverUrl,
                    e2eeKey,
                },
            });
            window.dispatchEvent(callEvent);

            console.log("✅ Dispatched incomingLiveKitCall event (no Redux state update, no old notifications)");
        },
    );

    // Listen for call declined events for LiveKit calls
    socket.on("call_declined", (data: any) => {
        console.log("📞 Received call_declined event in initializeSocket:", data);

        // Emit custom event for LiveKit call decline
        const declineEvent = new CustomEvent("liveKitCallDeclined", {
            detail: data,
        });
        window.dispatchEvent(declineEvent);
        console.log("📞 Dispatched liveKitCallDeclined custom event");
    });

    socket.on(events.NEW_PRODUCER, ({ producerId, producerPeerId, kind }) => {
        // Handle new producers
        console.log("New producer detected:", { producerId, producerPeerId, kind });
    });

    socket.on(events.PRODUCER_CLOSED, ({ consumerId }) => {
        // Handle producer closed
        console.log("Producer closed:", consumerId);
    });

    socket.on(events.PEER_LEFT, ({ peerId, roomId }) => {
        // Handle peer left
        console.log("Peer left:", { peerId, roomId });

        // Get Redux state
        const state = store.getState().call;

        // Remove the remote stream if it exists
        const stream = state.remoteStreams[peerId];
        if (stream) {
            // Stop all tracks in the stream
            stream.getTracks().forEach((track) => {
                track.stop();
            });
        }

        // Remove the stream from Redux store (will work even if stream doesn't exist)
        store.dispatch(removeRemoteStream(peerId));

        console.log(`Removed peer ${peerId} from call`);
    });

    return socket;
}

export default initializeSocketConnection;
