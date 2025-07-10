/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Socket } from "socket.io-client";
import * as events from "./socketEvents";
import { showToast } from "./notificationUtils";
import store from "./redux/store";
import { resetCallState } from "./redux/callReducer";
import GlobalSocketManager from "./GlobalSocketManager";

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
 * Use the global socket connection and set up additional event listeners
 * @param userId - The user ID to identify the connection
 * @returns The global socket instance
 */
export function initializeSocketConnection(userId: string): Socket | null {
    console.log("🔄 initializeSocketConnection: Using GlobalSocketManager instead of creating new socket");

    // Get the global socket instance
    const socket = GlobalSocketManager.getGlobalSocket();

    if (!socket) {
        console.error("❌ Global socket not available, make sure GlobalSocketManager is initialized");
        return null;
    }

    console.log("✅ Using global socket for user:", userId);

    // Set up additional event listeners that are specific to this component
    // (Most listeners are now in GlobalSocketManager)

    // Set up connection error handling
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

    // Legacy MediaSoup call decline handling (for backwards compatibility)
    socket.on(events.CALL_DECLINED, async ({ roomId: declinedRoomId, declinedBy }) => {
        console.log("📞 Legacy MediaSoup call declined event received", declinedRoomId);
        const participants = store.getState().call.participants;
        const username = participants[declinedBy]?.username || "User";
        showToast(`${username} declined the call`, "info");
        // Clean up call state
        store.dispatch(resetCallState());
    });

    // NOTE: Other event listeners (incoming_call, call_ended, call_declined for LiveKit)
    // are now handled by GlobalSocketManager to avoid duplicates

    console.log("✅ Additional socket event listeners set up via global socket");

    return socket;
}
