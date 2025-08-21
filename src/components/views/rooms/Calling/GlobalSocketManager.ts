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
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

console.log("socket.url", SOCKET_URL); // Type declarations for window properties used in LiveKit calling
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
    private currentDesktopNotification: Notification | null = null;
    private isUserMakingOutgoingCall: boolean = false; // Track if user is making an outgoing call
    private outgoingCallRoomId: string | null = null; // Track which room the outgoing call is for

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

        // Expose debug method globally for testing
        (window as any).testDesktopNotification = () => this.testDesktopNotification();

        console.log("✅ GlobalSocketManager initialized and listening for client events");
        console.log(
            "🧪 Debug: You can test desktop notifications by running 'testDesktopNotification()' in browser console",
        );
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

            console.log("🔑 Socket API Key Debug:", {
                apiKey: "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                socketUrl: SOCKET_URL,
                userId: userId,
            });

            // Initialize socket connection with correct configuration
            this.socket = io(SOCKET_URL, {
                auth: {
                    "userId": userId,
                    "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                },
                extraHeaders: {
                    "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                },
                // query: {
                //     "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                // },
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

        // Listen for call established events to clear outgoing call state
        window.addEventListener("liveKitCallEstablished", this.handleGlobalCallEstablished);

        // Listen for page visibility changes to handle desktop notifications
        document.addEventListener("visibilitychange", this.handleVisibilityChange);

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

        // Check if browser tab is visible/focused
        const isTabVisible = !document.hidden && document.hasFocus();
        console.log("🔍 Tab visibility status:", {
            isTabVisible,
            hidden: document.hidden,
            hasFocus: document.hasFocus(),
        });

        // Show desktop notification if tab is not visible (user on another tab or browser minimized)
        if (!isTabVisible) {
            console.log("🔔 Tab not visible, showing desktop notification");
            this.showIncomingCallDesktopNotification(callData);
        }

        // Debug what's available on window
        console.log("🔍 Window functions available:", {
            showLiveKitCallNotification: typeof window.showLiveKitCallNotification,
            clearAllLiveKitCallNotifications: typeof (window as any).clearAllLiveKitCallNotifications,
            stopIncomingCallSound: typeof (window as any).stopIncomingCallSound,
        });

        // Show in-tab notification using the global LiveKit notification system
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

        // Only start ring sound if notification was successfully created AND user is not already in a call
        if (notificationId) {
            // Double-check that user is not in an active call before playing ringtone
            if (this.isUserInActiveCall()) {
                console.log("🚫 User is already in an active call - not playing ringtone for incoming call");
                // Still show notification but don't play sound
                console.log(
                    "📤 GlobalSocketManager showed incoming LiveKit call notification (silent):",
                    notificationId,
                );
            } else {
                console.log("🔊 Starting ring sound for incoming LiveKit call (notification shown successfully)");
                LegacyCallHandler.instance.play(AudioID.Ring).catch((error) => {
                    console.warn("Failed to play ring sound:", error);
                });
                console.log("📤 GlobalSocketManager showed incoming LiveKit call notification:", notificationId);
            }
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

        // Close any desktop notifications
        this.closeIncomingCallDesktopNotifications();

        // Remove any existing LiveKit call notifications to prevent overlay issues
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications");

        // Send call picked up event to backend to notify other devices
        if (this.socket && callData.roomId && currentUserId) {
            const pickupData = {
                roomId: callData.roomId,
                userId: currentUserId,
                timestamp: new Date().toISOString(),
            };

            console.log("📤 GlobalSocketManager emitting call_picked_up event:", pickupData);
            this.socket.emit("call_picked_up", pickupData);
        } else {
            console.warn("❌ Cannot emit call_picked_up - socket, roomId, or userId not available");
        }

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
    };

    /**
     * Handle rejecting an incoming call
     */
    private handleRejectIncomingCall = (callData: any): void => {
        console.log("❌ GlobalSocketManager: Rejecting incoming LiveKit call:", callData);

        const matrixClient = MatrixClientPeg.get();
        const currentUserId = matrixClient?.getUserId();

        // Close any desktop notifications
        this.closeIncomingCallDesktopNotifications();

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

        // Close any desktop notifications
        this.closeIncomingCallDesktopNotifications();

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
     * Handle call declined events at global level - CENTRALIZED HANDLER
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
            console.log("📞 Full decline event data:", data);
            console.log("📞 Stored outgoing call roomId:", this.outgoingCallRoomId);
            console.log("📞 Checking if user was making an outgoing call:", this.isUserMakingOutgoingCall);

            // Only process if we were making an outgoing call
            if (this.isUserMakingOutgoingCall) {
                console.log("📞 User was making an outgoing call, processing decline");

                // Clear any outgoing call notifications
                if ((window as any).clearAllLiveKitCallNotifications) {
                    (window as any).clearAllLiveKitCallNotifications();
                }

                // SIMPLIFIED APPROACH: Direct call closure
                console.log("📞 Attempting direct call closure methods");

                // Method 1: Set global call state to false
                if ((window as any).setCallActiveState) {
                    console.log("📞 Setting global call active state to false");
                    (window as any).setCallActiveState(false);
                }

                // Method 2: Call global close function if available
                if ((window as any).globalCloseLiveKitCall) {
                    console.log("📞 Calling global close function");
                    (window as any).globalCloseLiveKitCall();
                }

                // Method 3: Dispatch simplified close event
                const closeEvent = new CustomEvent("forceCloseLiveKitCall", {
                    detail: {
                        reason: "declined",
                        roomId: data.roomId || this.outgoingCallRoomId,
                    },
                });
                window.dispatchEvent(closeEvent);
                console.log("📞 Dispatched forceCloseLiveKitCall event");

                // Method 4: Force remove LiveKit call modal from DOM
                setTimeout(() => {
                    // Remove any LiveKit modal containers
                    const modalContainers = document.querySelectorAll('[style*="position: fixed"][style*="z-index"]');
                    modalContainers.forEach((container) => {
                        if (container.innerHTML.includes("lk-") || container.innerHTML.includes("LiveKit")) {
                            console.log("📞 Force removing LiveKit modal from DOM");
                            container.remove();
                        }
                    });

                    // Remove LiveKit body class
                    document.body.classList.remove("mx_LiveKitCall_active");
                    console.log("📞 Removed LiveKit body class");
                }, 500); // Small delay to ensure other methods run first

                // Show toast notification that call was declined
                const declinedByUser = data.declinedBy || "User";
                console.log("📞 Attempting to show toast notification");
                console.log("📞 window.showToast available:", !!window.showToast);

                if (window.showToast) {
                    console.log("📞 Calling window.showToast");
                    window.showToast(`Call declined by ${declinedByUser}`, "info", 3000);
                    console.log("📞 Toast notification called successfully");
                } else {
                    console.warn("📞 window.showToast not available, using fallback");
                    // Fallback: Use the showToast from RoomHeader imports
                    try {
                        const { showToast } = require("../Calling/notificationUtils");
                        showToast(`Call declined by ${declinedByUser}`, "info", 3000);
                        console.log("📞 Fallback toast shown");
                    } catch (error) {
                        console.error("📞 Fallback toast failed:", error);
                        console.log(`📞 Call declined by ${declinedByUser}`);
                    }
                }

                // Clear outgoing call state since call was declined
                this.setOutgoingCallState(false);

                console.log("📞 Call decline handled successfully by GlobalSocketManager");
            } else {
                console.log("📞 User was not making an outgoing call, ignoring decline notification");
            }
        }
    };

    /**
     * Handle call established events at global level
     */
    private handleGlobalCallEstablished = (event: Event): void => {
        const customEvent = event as CustomEvent;
        const data = customEvent.detail;

        console.log("✅ GlobalSocketManager: Call successfully established", data);

        // Clear outgoing call state since call is now successfully connected
        // This prevents showing decline notifications on subsequent calls from other devices
        if (this.isUserMakingOutgoingCall) {
            console.log("📞 Call established successfully, clearing outgoing call state");
            this.setOutgoingCallState(false);
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

        // Close any desktop notifications for incoming calls
        this.closeIncomingCallDesktopNotifications();

        // Clear global call state
        if ((window as any).__globalActiveCallData) {
            delete (window as any).__globalActiveCallData;
        }

        // Clear outgoing call state since call has ended
        this.setOutgoingCallState(false);

        console.log("🧹 GlobalSocketManager completed call ended cleanup");
    };

    /**
     * Check if user is currently in an active call
     */
    private isUserInActiveCall(): boolean {
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
        const hasActiveCallUI = document.querySelector(".lk-video-grid") || document.querySelector(".mx_CallView");

        return !!(hasLiveKitModal || hasMediaSoupModal || hasActiveCallUI);
    }

    /**
     * Handle page visibility changes
     */
    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            console.log("🔍 Page became visible - user switched back to tab");
            // Add a small delay before closing desktop notifications to give user time to see them
            // This prevents the notification from closing immediately when testing by switching tabs
            setTimeout(() => {
                if (!document.hidden) {
                    // Double-check user is still on the tab
                    console.log("🔍 User still on tab after delay, closing desktop notifications");
                    this.closeIncomingCallDesktopNotifications();
                } else {
                    console.log("🔍 User switched away again, keeping desktop notifications");
                }
            }, 2000); // 2 second delay
        } else {
            console.log("🔍 Page became hidden - user switched away from tab");
        }
    };

    /**
     * Close any incoming call desktop notifications
     */
    private closeIncomingCallDesktopNotifications(): void {
        try {
            if (this.currentDesktopNotification) {
                console.log("🔔 Closing current incoming call desktop notification");
                this.currentDesktopNotification.close();
                this.currentDesktopNotification = null;
            } else {
                console.log("🔔 No desktop notification to close");
            }
        } catch (error) {
            console.warn("Failed to close desktop notifications:", error);
        }
    }

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
            if (this.isUserInActiveCall()) {
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

        // Listen for cancel incoming call events from backend (when call is picked up on another device)
        this.socket.on("cancel_incoming_call", (data: any) => {
            console.log("📞 GlobalSocketManager: Received cancel_incoming_call from backend", data);
            console.log("📞 Call was picked up on another device, cleaning up notifications on this device");

            const { roomId, pickedUpBy } = data;

            // Immediately stop ring sounds
            console.log("🔇 Stopping ring sounds due to call pickup on another device");
            LegacyCallHandler.instance.pause(AudioID.Ring);

            // Stop any custom incoming call sounds
            if ((window as any).stopIncomingCallSound) {
                (window as any).stopIncomingCallSound();
                console.log("🔇 Stopped incoming call sound due to call pickup on another device");
            }

            // Clear all LiveKit call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
                console.log("🧹 Cleared all notifications due to call pickup on another device");
            } else {
                // Fallback if function not available yet
                document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
                console.log("🧹 Cleared all notifications (fallback) due to call pickup on another device");
            }

            // Close any desktop notifications
            this.closeIncomingCallDesktopNotifications();

            // Show brief toast notification that call was picked up on another device
            if (window.showToast) {
                window.showToast("Call answered on another device", "info", 3000);
            } else {
                console.log("ℹ️ Call was answered on another device");
            }

            console.log(
                `✅ GlobalSocketManager: Call pickup cleanup completed for room ${roomId} (picked up by ${pickedUpBy})`,
            );
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

        // Only start ring sound if user is not already in an active call
        if (this.isUserInActiveCall()) {
            console.log("🚫 User is already in an active call - not playing ringtone for fallback notification");
        } else {
            console.log("🔊 Playing ring sound for fallback notification");
            LegacyCallHandler.instance.play(AudioID.Ring).catch((error) => {
                console.warn("Failed to play ring sound:", error);
            });
        }

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
     * Show a desktop notification for incoming calls when tab is not visible
     * Simplified version based on the working call_ended notification pattern
     */
    private showIncomingCallDesktopNotification(callData: any): void {
        try {
            console.log("🔔 Showing incoming call desktop notification");

            // Check if browser supports notifications
            if (!("Notification" in window)) {
                console.warn("❌ Browser does not support desktop notifications");
                return;
            }

            const caller = callData.isGroup ? callData.groupName : callData.fromUsername;
            const callType = callData.isVideo ? "Video" : "Voice";

            // Function to create the notification (simplified like call_ended)
            const createNotification = (): void => {
                try {
                    console.log("🔔 Creating incoming call desktop notification");

                    // Close any existing desktop notification first
                    if (this.currentDesktopNotification) {
                        this.currentDesktopNotification.close();
                        this.currentDesktopNotification = null;
                    }

                    // Create notification with action buttons (fallback to simple notification)
                    const notificationOptions: NotificationOptions = {
                        body: `${caller} is calling...`,
                        icon: "/favicon.ico",
                        requireInteraction: true, // Keep notification until user interacts
                        tag: "incoming-call", // Replace any existing call notifications
                    };

                    // Note: Action buttons require service worker notifications, not regular Notification constructor
                    // For now, using simple notification that focuses window to show in-tab Accept/Decline
                    notificationOptions.body = `${caller} is calling... Click to open tab and respond`;

                    const notification = new Notification(`Incoming ${callType} Call`, notificationOptions);

                    // Store reference to current notification
                    this.currentDesktopNotification = notification;

                    // Handle notification click (focus window to show Accept/Decline UI)
                    notification.onclick = () => {
                        console.log("🔔 Desktop notification clicked - focusing window to show Accept/Decline options");
                        window.focus(); // Bring browser window to front
                        notification.close();
                        this.currentDesktopNotification = null;

                        // Don't auto-accept - let user interact with in-tab notification
                        // The in-tab notification should already be visible with proper Accept/Decline buttons
                    };

                    // Handle notification close
                    notification.onclose = () => {
                        console.log("🔔 Desktop notification closed");
                        this.currentDesktopNotification = null;
                    };

                    // Auto-close notification after 30 seconds
                    setTimeout(() => {
                        if (this.currentDesktopNotification === notification) {
                            console.log("⏰ Desktop notification auto-closing after 30 seconds");
                            notification.close();
                            this.currentDesktopNotification = null;
                            // Handle timeout dismiss (no backend event)
                            this.handleTimeoutDismiss(callData);
                        }
                    }, 30000);

                    console.log("✅ Incoming call desktop notification created successfully");
                } catch (error) {
                    console.error("💥 Error creating desktop notification:", error);
                    this.currentDesktopNotification = null;
                }
            };

            // Check permission and create notification (same pattern as call_ended)
            if (Notification.permission === "granted") {
                createNotification();
            } else if (Notification.permission !== "denied") {
                // Request permission and show notification if granted
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        createNotification();
                    } else {
                        console.warn("❌ Desktop notification permission denied");
                    }
                });
            } else {
                console.warn("❌ Desktop notifications are blocked by user");
            }
        } catch (error) {
            console.warn("💥 Failed to show incoming call desktop notification:", error);
        }
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
     * Debug method to test desktop notifications manually
     * Can be called from browser console: window.testDesktopNotification()
     */
    public testDesktopNotification(): void {
        console.log("🧪 Testing desktop notification manually");

        const testCallData = {
            fromUsername: "Test User",
            isGroup: false,
            isVideo: true,
        };

        this.showIncomingCallDesktopNotification(testCallData);
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
     * Set outgoing call state when user initiates a call
     */
    public setOutgoingCallState(isOutgoing: boolean, roomId?: string): void {
        this.isUserMakingOutgoingCall = isOutgoing;
        this.outgoingCallRoomId = isOutgoing ? roomId || null : null;
        console.log(
            `📞 GlobalSocketManager: Outgoing call state set to ${isOutgoing}${roomId ? ` for room ${roomId}` : ""}`,
        );
    }

    /**
     * Check if user is currently making an outgoing call
     */
    public isUserMakingCall(): boolean {
        return this.isUserMakingOutgoingCall;
    }

    /**
     * Get the room ID of the current outgoing call
     */
    public getOutgoingCallRoomId(): string | null {
        return this.outgoingCallRoomId;
    }

    /**
     * Static method to set outgoing call state from anywhere
     */
    public static setGlobalOutgoingCallState(isOutgoing: boolean, roomId?: string): void {
        const instance = GlobalSocketManager.getInstance();
        instance.setOutgoingCallState(isOutgoing, roomId);
    }

    /**
     * Static method to check if user is making an outgoing call from anywhere
     */
    public static isGlobalUserMakingCall(): boolean {
        const instance = GlobalSocketManager.getInstance();
        return instance.isUserMakingCall();
    }

    /**
     * Clean up resources
     */
    private cleanup(): void {
        console.log("🧹 Cleaning up GlobalSocketManager resources");

        // Remove global event listeners
        window.removeEventListener("incomingLiveKitCall", this.handleGlobalIncomingCall);
        window.removeEventListener("incomingCall", this.handleGlobalIncomingCall);
        window.removeEventListener("liveKitCallDeclined", this.handleGlobalCallDeclined);
        window.removeEventListener("liveKitCallEnded", this.handleGlobalCallEnded);
        window.removeEventListener("liveKitCallEstablished", this.handleGlobalCallEstablished);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);

        // Close any open desktop notifications
        this.closeIncomingCallDesktopNotifications();

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
