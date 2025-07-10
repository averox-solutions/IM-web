/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { io, type Socket } from "socket.io-client";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import type { ActionPayload } from "../../../../dispatcher/payloads";
import LegacyCallHandler, { AudioID } from "../../../../LegacyCallHandler";

// Use the same backend URL as the existing socket service
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || "ws://localhost:3000";

// Type declarations for window properties used in LiveKit calling
declare global {
    interface Window {
        showLiveKitCallNotification?: (
            type: "incoming" | "outgoing",
            data: {
                caller: string;
                isVideo: boolean;
                participantCount?: number;
                onAccept?: () => void;
                onDecline?: () => void;
                onDismiss?: () => void;
            },
        ) => string;
        clearAllLiveKitCallNotifications?: () => void;
        stopIncomingCallSound?: () => void;
        showToast?: (message: string, type: string, duration?: number) => void;
        getCallActiveState?: () => boolean; // Added for new call logic
    }
}

/**
 * GlobalSocketManager handles socket connection lifecycle at the application level.
 * This ensures that the calling backend socket connection is established early
 * in the app lifecycle, allowing for consistent incoming call handling.
 */
class GlobalSocketManager {
    private static instance: GlobalSocketManager | null = null;
    private socket: Socket | null = null;
    private isInitialized: boolean = false;
    private dispatcherRef: string | null = null;

    /**
     * Get the singleton instance
     */
    public static getInstance(): GlobalSocketManager {
        if (!GlobalSocketManager.instance) {
            GlobalSocketManager.instance = new GlobalSocketManager();
        }
        return GlobalSocketManager.instance;
    }

    /**
     * Initialize the global socket manager
     * This should be called once during app startup
     */
    public initialize(): void {
        if (this.isInitialized) {
            console.warn("GlobalSocketManager already initialized");
            return;
        }

        console.log("🔌 Initializing GlobalSocketManager");

        // Register dispatcher to listen for Matrix client events
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.isInitialized = true;

        console.log("✅ GlobalSocketManager initialized and listening for client events");
    }

    /**
     * Handle dispatcher actions
     */
    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "client_started":
                this.onClientStarted();
                break;
            case Action.OnLoggedOut:
                this.onLoggedOut();
                break;
            case "will_start_client":
                // Client is about to start, prepare for socket initialization
                console.log("🔄 Matrix client starting, preparing socket initialization");
                break;
        }
    };

    /**
     * Called when the Matrix client has started
     */
    private onClientStarted(): void {
        console.log("🚀 Matrix client started, initializing calling backend socket connection");

        try {
            const matrixClient = MatrixClientPeg.get();

            if (!matrixClient) {
                console.warn("❌ Matrix client not available, cannot initialize socket");
                return;
            }

            const userId = matrixClient.getUserId();

            if (!userId) {
                console.warn("❌ User ID not available, cannot initialize socket");
                return;
            }

            // Initialize socket connection with correct configuration
            this.socket = io(SOCKET_URL, {
                auth: {
                    userId: userId,
                },
                transports: ["websocket"],
                forceNew: true,
            });

            if (this.socket) {
                console.log("✅ Calling backend socket connection established successfully");
                console.log(`📞 Socket connected for user: ${userId}`);

                // Set up ALL socket event handlers (both global and backend listeners)
                this.setupGlobalSocketHandlers();
                this.setupSocketListeners();
            } else {
                console.error("❌ Failed to establish calling backend socket connection");
            }
        } catch (error) {
            console.error("💥 Error initializing calling backend socket:", error);
        }
    }

    /**
     * Called when user logs out
     */
    private onLoggedOut(): void {
        console.log("👋 User logged out, cleaning up socket connection");
        this.cleanup();
    }

    /**
     * Set up global socket event handlers that should be available app-wide
     */
    private setupGlobalSocketHandlers(): void {
        if (!this.socket) {
            console.warn("No socket available for setting up global handlers");
            return;
        }

        console.log("🎯 Setting up global socket event handlers");

        // Listen for connection status changes
        this.socket.on("connect", () => {
            console.log("🟢 Calling backend socket connected");

            // Emit add_user event to register user as online
            const matrixClient = MatrixClientPeg.get();
            const userId = matrixClient?.getUserId();
            if (userId) {
                console.log(`📡 Emitting add_user event for ${userId}`);
                this.socket!.emit("add_user", userId);
            } else {
                console.warn("❌ Cannot emit add_user: User ID not available");
            }
        });

        this.socket.on("disconnect", (reason) => {
            console.log("🔴 Calling backend socket disconnected:", reason);
        });

        this.socket.on("reconnect", (attemptNumber) => {
            console.log("🔄 Calling backend socket reconnected after", attemptNumber, "attempts");
        });

        this.socket.on("connect_error", (error) => {
            console.error("❌ Calling backend socket connection error:", error);
        });

        // Set up incoming call notification system at global level
        this.setupGlobalIncomingCallHandler();
    }

    /**
     * Set up global incoming call notification system
     */
    private setupGlobalIncomingCallHandler(): void {
        console.log("📞 Setting up global incoming call notification system");

        // Listen for incoming LiveKit calls globally
        window.addEventListener("incomingLiveKitCall", this.handleGlobalIncomingCall);

        // Listen for legacy incoming calls globally (for non-LiveKit calls)
        window.addEventListener("incomingCall", this.handleGlobalIncomingCall);

        // Listen for call declined events globally
        window.addEventListener("liveKitCallDeclined", this.handleGlobalCallDeclined);

        // Listen for call ended events globally
        window.addEventListener("liveKitCallEnded", this.handleGlobalCallEnded);

        console.log("✅ Global incoming call handlers established");
    }

    /**
     * Handle incoming LiveKit calls at global level
     */
    private handleGlobalIncomingCall = (event: Event): void => {
        const customEvent = event as CustomEvent;
        const callData = customEvent.detail;

        console.log("📞 GlobalSocketManager: Incoming call received", callData);
        console.log("🔍 Event type:", customEvent.type);

        if (!callData) {
            console.warn("❌ No call data provided in incoming call event");
            return;
        }

        // Determine caller name for display
        const caller = callData.isGroup ? callData.groupName : callData.fromUsername;

        console.log("📞 Processing incoming call from:", caller);

        // Debug what's available on window
        console.log("🔍 Window functions available:", {
            showLiveKitCallNotification: typeof window.showLiveKitCallNotification,
            clearAllLiveKitCallNotifications: typeof (window as any).clearAllLiveKitCallNotifications,
            stopIncomingCallSound: typeof (window as any).stopIncomingCallSound,
        });

        // Show notification using the global LiveKit notification system
        if (!window.showLiveKitCallNotification) {
            console.error("❌ showLiveKitCallNotification not available on window");
            console.error(
                "❌ Available window properties:",
                Object.keys(window).filter((k) => k.includes("Call")),
            );

            // Fallback: Create a simple notification ourselves
            console.log("🔔 Creating fallback notification");
            this.createFallbackNotification(callData);
            return;
        }

        // Show notification first, then start ring sound only if notification shows successfully
        const notificationId = window.showLiveKitCallNotification("incoming", {
            caller: caller,
            isVideo: callData.isVideo,
            onAccept: () => {
                console.log("✅ Incoming call accepted from GlobalSocketManager");
                // Stop ring sound when accepting from notification
                LegacyCallHandler.instance.pause(AudioID.Ring);
                this.handleAcceptIncomingCall(callData);
            },
            onDecline: () => {
                console.log("❌ Incoming call declined from GlobalSocketManager");
                // Stop ring sound when declining from notification
                LegacyCallHandler.instance.pause(AudioID.Ring);
                this.handleRejectIncomingCall(callData);
            },
            onDismiss: () => {
                console.log("⏰ Incoming call notification dismissed (30s timeout)");
                // Stop ring sound when auto-dismissed after 30s
                LegacyCallHandler.instance.pause(AudioID.Ring);
                this.handleTimeoutDismiss(callData);
            },
        });

        // Only start ring sound if notification was successfully created
        if (notificationId) {
            console.log("🔊 Starting ring sound for incoming LiveKit call (notification shown successfully)");
            LegacyCallHandler.instance.play(AudioID.Ring).catch((error) => {
                console.warn("Failed to play ring sound:", error);
            });

            console.log("📤 GlobalSocketManager showed incoming LiveKit call notification:", notificationId);
        } else {
            console.warn("❌ Failed to show notification, not playing ring sound");
        }
    };

    /**
     * Handle accepting an incoming call
     */
    private handleAcceptIncomingCall = (callData: any): void => {
        console.log("✅ GlobalSocketManager: Accepting incoming LiveKit call:", callData);

        const matrixClient = MatrixClientPeg.get();
        const currentUserId = matrixClient?.getUserId();

        // Remove any existing LiveKit call notifications to prevent overlay issues
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications");

        // Prepare call data for LiveKitRoomManager
        const activeCall = {
            roomId: callData.roomId,
            participantName: currentUserId || "Unknown User",
            token: callData.token,
            serverUrl: callData.serverUrl,
            e2eeKey: callData.e2eeKey,
            callType: callData.isVideo ? ("video" as const) : ("voice" as const),
            isIncoming: true,
        };

        // Set the active call data globally
        (window as any).__globalActiveCallData = activeCall;

        // Dispatch a custom event to notify the UI about accepted call
        const acceptedCallEvent = new CustomEvent("globalCallAccepted", {
            detail: activeCall,
        });
        window.dispatchEvent(acceptedCallEvent);

        console.log("📤 GlobalSocketManager dispatched globalCallAccepted event");

        // TODO: Send acceptance response to backend
        console.log("📤 Should send call acceptance to backend");
    };

    /**
     * Handle rejecting an incoming call
     */
    private handleRejectIncomingCall = (callData: any): void => {
        console.log("❌ GlobalSocketManager: Rejecting incoming LiveKit call:", callData);

        const matrixClient = MatrixClientPeg.get();
        const currentUserId = matrixClient?.getUserId();

        // Remove any existing LiveKit call notifications
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications");

        // Send rejection response to backend using the global socket
        if (this.socket && callData) {
            const declineData = {
                roomId: callData.roomId,
                fromUserId: callData.fromUserId,
                toUserId: currentUserId,
                isGroup: callData.isGroup || false,
                timestamp: new Date().toISOString(),
            };

            console.log("📤 GlobalSocketManager emitting CALL_DECLINED event:", declineData);
            this.socket.emit("call_declined", declineData);
        } else {
            console.warn("❌ Cannot send call rejection - socket or callData not available");
        }
    };

    /**
     * Handle timeout dismissal of incoming call notification (no backend event)
     */
    private handleTimeoutDismiss = (callData: any): void => {
        console.log("⏰ GlobalSocketManager: Call notification timeout - cleaning up without sending decline event");

        // Remove any existing LiveKit call notifications
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications due to timeout");

        // Note: We do NOT send a decline event to the backend for timeouts
        // The caller/backend should handle the timeout themselves
        console.log("ℹ️ No decline event sent - timeout should be handled by caller/backend");
    };

    /**
     * Handle call declined events at global level
     */
    private handleGlobalCallDeclined = (event: Event): void => {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;

        console.log("❌ GlobalSocketManager: Call declined", data);

        // Stop any ring sounds immediately when call is declined
        LegacyCallHandler.instance.pause(AudioID.Ring);

        // Global cleanup for declined calls
        const matrixClient = MatrixClientPeg.get();
        const currentUserId = matrixClient?.getUserId();

        // Check if this decline is for our current outgoing call
        if (data && data.fromUserId === currentUserId) {
            console.log("📞 Our call was declined by:", data.declinedBy);

            // Clear any outgoing call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
            }

            // Show toast notification that call was declined
            const declinedByUser = data.declinedBy || "User";
            // Assuming showToast is available on window or removed if not needed
            // For now, keeping it as it was in the original file
            if (window.showToast) {
                window.showToast(`Call declined by ${declinedByUser}`, "info", 3000);
            } else {
                console.warn("showToast not available on window, cannot show declined call toast");
            }

            console.log("📞 Call decline handled successfully by GlobalSocketManager");
        }
    };

    /**
     * Handle call ended events at global level
     */
    private handleGlobalCallEnded = (event: Event): void => {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;

        console.log("📞 GlobalSocketManager: Call ended", data);

        // Global cleanup for ended calls - stop ALL sounds immediately
        LegacyCallHandler.instance.pause(AudioID.Ring);

        // Stop incoming call sounds (if any custom sounds are playing)
        if ((window as any).stopIncomingCallSound) {
            (window as any).stopIncomingCallSound();
        }

        // Clear all call notifications
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        }

        // Clear global call state
        if ((window as any).__globalActiveCallData) {
            delete (window as any).__globalActiveCallData;
        }

        console.log("🧹 GlobalSocketManager completed call ended cleanup");
    };

    /**
     * Set up socket event listeners for backend communication
     */
    private setupSocketListeners(): void {
        if (!this.socket) return;

        console.log("📞 GlobalSocketManager: Setting up backend socket event listeners");

        // Listen for incoming LiveKit calls from backend
        this.socket.on("incoming_call", async (callData: any) => {
            console.log("📞 GlobalSocketManager: Received incoming_call from backend", callData);

            const {
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
            } = callData;

            // Debug logging
            console.log("🔍 Call data details:", {
                hasToken: !!token,
                hasServerUrl: !!serverUrl,
                roomId,
                fromUsername,
                isVideo,
                isGroup,
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
                console.log("🚫 GlobalSocketManager: Ignoring incoming call - user is already in an active call:", {
                    roomId,
                    fromUsername,
                    isVideo,
                    isGroup,
                    reason: "User already in call",
                    hasToken: !!token,
                    hasServerUrl: !!serverUrl,
                    timestamp: new Date().toISOString(),
                });
                return; // Ignore this incoming call
            }

            // Check if this is a LiveKit call (has token and serverUrl)
            const isLiveKitCall = !!(token && serverUrl);

            if (isLiveKitCall) {
                // This is a LiveKit call - handle with new system
                console.log("🚀 GlobalSocketManager: Handling as LiveKit call (token provided)");

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

                console.log("✅ GlobalSocketManager: Dispatched incomingLiveKitCall event");
            } else {
                // This is a legacy MediaSoup call - handle with old system
                console.log("📞 GlobalSocketManager: Handling as MediaSoup call (no LiveKit token)");

                // Dispatch legacy incoming call event for old system
                const legacyCallEvent = new CustomEvent("incomingCall", {
                    detail: callData,
                });
                window.dispatchEvent(legacyCallEvent);

                console.log("✅ GlobalSocketManager: Dispatched legacy incomingCall event");
            }
        });

        // Listen for call ended events from backend
        this.socket.on("call_ended", (data: any) => {
            console.log("📞 GlobalSocketManager: Received call_ended from backend", data);
            console.log("📞 Call ended by initiator, stopping notifications and ringtones");

            const { endedBy } = data;

            // Immediately stop ring sounds and dismiss notifications
            console.log("🔇 Stopping ring sounds due to call ended by initiator");
            LegacyCallHandler.instance.pause(AudioID.Ring);

            // Stop any custom incoming call sounds
            if ((window as any).stopIncomingCallSound) {
                (window as any).stopIncomingCallSound();
                console.log("🔇 Stopped incoming call sound due to call ended");
            }

            // Clear all LiveKit call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
                console.log("🧹 Cleared all notifications due to call ended by initiator");
            }

            // Show brief browser notification that call was ended
            this.showCallEndedNotification(endedBy);

            // Emit custom event for other components
            const callEndedEvent = new CustomEvent("liveKitCallEnded", {
                detail: data,
            });
            window.dispatchEvent(callEndedEvent);

            console.log("✅ GlobalSocketManager: Call ended handling completed");
        });

        // Listen for call declined events from backend
        this.socket.on("call_declined", (data: any) => {
            console.log("📞 GlobalSocketManager: Received call_declined from backend", data);

            // Dispatch custom event for call declined
            const callDeclinedEvent = new CustomEvent("liveKitCallDeclined", {
                detail: data,
            });
            window.dispatchEvent(callDeclinedEvent);

            console.log("✅ GlobalSocketManager: Dispatched liveKitCallDeclined event");
        });

        console.log("✅ GlobalSocketManager: Backend socket event listeners established");
    }

    /**
     * Create a fallback notification when the main notification system is unavailable
     */
    private createFallbackNotification(callData: any): void {
        console.log("📞 Creating fallback incoming call notification");

        const caller = callData.isGroup ? callData.groupName : callData.fromUsername;
        const callType = callData.isVideo ? "Video" : "Voice";

        // Start ring sound
        console.log("🔊 Playing ring sound for fallback notification");
        LegacyCallHandler.instance.play(AudioID.Ring).catch((error) => {
            console.warn("Failed to play ring sound:", error);
        });

        // Create simple notification
        const notification = document.createElement("div");
        notification.className = "mx_LiveKitCallNotification fallback-notification";
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e1e1e;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            min-width: 300px;
            font-family: Inter, Arial, sans-serif;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="font-size: 24px; margin-right: 10px;">${callData.isVideo ? "📹" : "📞"}</div>
                <div>
                    <div style="font-weight: bold;">Incoming ${callType} Call</div>
                    <div style="font-size: 14px; opacity: 0.8;">${caller}</div>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="decline-call" style="background: #d32f2f; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Decline
                </button>
                <button id="accept-call" style="background: #2e7d32; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Accept
                </button>
            </div>
        `;

        const handleAccept = (): void => {
            console.log("✅ Fallback notification: Call accepted");
            LegacyCallHandler.instance.pause(AudioID.Ring);
            notification.remove();
            this.handleAcceptIncomingCall(callData);
        };

        const handleDecline = (): void => {
            console.log("❌ Fallback notification: Call declined");
            LegacyCallHandler.instance.pause(AudioID.Ring);
            notification.remove();
            this.handleRejectIncomingCall(callData);
        };

        // Add event listeners
        notification.querySelector("#accept-call")?.addEventListener("click", handleAccept);
        notification.querySelector("#decline-call")?.addEventListener("click", handleDecline);

        // Auto-dismiss after 30 seconds
        const timeout = setTimeout(() => {
            console.log("⏰ Fallback notification: Auto-dismissing after 30 seconds");
            LegacyCallHandler.instance.pause(AudioID.Ring);
            notification.remove();
            this.handleTimeoutDismiss(callData);
        }, 30000);

        // Store timeout for cleanup
        (notification as any).timeoutId = timeout;

        document.body.appendChild(notification);
        console.log("✅ Fallback notification created and displayed");
    }

    /**
     * Show a browser notification for call ended
     */
    private showCallEndedNotification(endedBy: string): void {
        try {
            // Check if browser supports notifications
            if (!("Notification" in window)) {
                console.warn("Browser does not support desktop notifications");
                return;
            }

            // Check if permission is already granted
            if (Notification.permission === "granted") {
                new Notification("Call Ended", {
                    body: `Call ended by ${endedBy}`,
                    icon: "/favicon.ico",
                });
            } else if (Notification.permission !== "denied") {
                // Request permission and show notification if granted
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        new Notification("Call Ended", {
                            body: `Call ended by ${endedBy}`,
                            icon: "/favicon.ico",
                        });
                    }
                });
            }
        } catch (error) {
            console.warn("Failed to show call ended notification:", error);
        }
    }

    /**
     * Get the current socket instance
     */
    public getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Static method to get the global socket instance from anywhere
     */
    public static getGlobalSocket(): Socket | null {
        const instance = GlobalSocketManager.getInstance();
        return instance.getSocket();
    }

    /**
     * Check if socket is connected
     */
    public isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Clean up resources
     */
    private cleanup(): void {
        console.log("🧹 Cleaning up GlobalSocketManager resources");

        // Remove global event listeners
        window.removeEventListener("incomingLiveKitCall", this.handleGlobalIncomingCall);
        window.removeEventListener("liveKitCallDeclined", this.handleGlobalCallDeclined);
        window.removeEventListener("liveKitCallEnded", this.handleGlobalCallEnded);

        // Properly disconnect socket
        if (this.socket?.connected) {
            console.log("🔌 Disconnecting global socket");
            this.socket.disconnect();
        }
        this.socket = null;
        console.log("✅ GlobalSocketManager resources cleaned up");
    }

    /**
     * Destroy the manager completely
     */
    public destroy(): void {
        this.cleanup();

        if (this.dispatcherRef) {
            defaultDispatcher.unregister(this.dispatcherRef);
            this.dispatcherRef = null;
        }

        this.isInitialized = false;
        console.log("💀 GlobalSocketManager destroyed");
    }
}

export default GlobalSocketManager;
