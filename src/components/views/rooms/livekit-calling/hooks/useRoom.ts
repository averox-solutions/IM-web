/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState, useCallback, useRef } from "react";
import { ExternalE2EEKeyProvider } from "livekit-client";

import { CREATE_ROOM_ENDPOINT } from "../config";
import { showToast } from "../../Calling/notificationUtils";

interface UseRoomProps {
    roomName?: string; // For backward compatibility
    participantName?: string; // For backward compatibility
    // New calling format
    roomId?: string;
    toUserIds?: string[];
    toUsernames?: { [userId: string]: string };
    isVideo?: boolean;
    fromUsername?: string;
    groupName?: string;
    isJoiningOngoingCall?: boolean; // Flag to indicate user is joining an ongoing call
    testMode?: {
        useWrongKey?: boolean; // For testing - will modify the key to simulate wrong key
        customKey?: string; // For testing - use a completely custom key
        useProvidedToken?: boolean; // For incoming calls - use provided token instead of creating new room
        providedToken?: string; // The token provided from incoming call
        providedServerUrl?: string; // The server URL provided from incoming call
    };
}

interface RoomResponse {
    token: string;
    serverUrl: string;
    e2eeKey: string;
    roomId: string;
    participants?: Array<{
        userId: string;
        username: string;
        isOnline: boolean;
    }>;
}

// Enhanced room options type with E2EE support
interface RoomOptions {
    publishDefaults?: {
        simulcast?: boolean;
    };
    adaptiveStream?: boolean;
    dynacast?: boolean;
    e2ee?: {
        keyProvider: any;
        worker: Worker;
    };
}

export const useRoom = ({
    roomName,
    participantName,
    roomId,
    toUserIds,
    toUsernames,
    isVideo,
    fromUsername,
    groupName,
    isJoiningOngoingCall,
    testMode,
}: UseRoomProps): {
    token: string;
    serverUrl: string;
    error: string;
    isConnecting: boolean;
    connect: () => Promise<void>;
    checkRoom: () => Promise<RoomResponse | null>;
    roomOptions: RoomOptions | null;
} => {
    const [token, setToken] = useState<string>("");
    const [serverUrl, setServerUrl] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [roomOptions, setRoomOptions] = useState<RoomOptions | null>(null);
    const connectionInProgress = useRef(false);

    const connect = useCallback(async (): Promise<void> => {
        // Prevent duplicate connection attempts
        if (connectionInProgress.current) {
            console.log("Connection already in progress, skipping...");
            return;
        }

        try {
            connectionInProgress.current = true;
            setIsConnecting(true);
            setError("");

            // Check if we have a provided token (for incoming calls)
            if (testMode?.useProvidedToken && testMode?.providedToken && testMode?.providedServerUrl) {
                console.log("📞 Using provided token for incoming call connection:", {
                    tokenPreview: testMode.providedToken.substring(0, 20) + "...",
                    serverUrl: testMode.providedServerUrl,
                });

                // Use the provided token directly without making API call
                const keyProvider = new ExternalE2EEKeyProvider();

                // Use the custom key if provided in testMode
                const e2eeKey = testMode.customKey || "default-e2ee-key-for-incoming-call";
                await keyProvider.setKey(e2eeKey);

                // Create E2EE worker
                const worker = new Worker(new URL("../workers/e2ee.worker.ts", import.meta.url), { type: "module" });

                worker.onerror = (error) => {
                    console.error("E2EE Worker error:", error);
                    setError("Failed to initialize E2EE worker");
                };

                worker.onmessage = (event) => {
                    console.log("E2EE Worker message:", event.data);
                };

                // Create room options with E2EE configuration
                const options: RoomOptions = {
                    e2ee: {
                        keyProvider,
                        worker,
                    },
                    publishDefaults: {
                        simulcast: false,
                    },
                    adaptiveStream: false,
                    dynacast: false,
                };

                // Set the provided connection details directly
                setToken(testMode.providedToken);
                setServerUrl(testMode.providedServerUrl);
                setRoomOptions(options);

                console.log("✅ Incoming call connection ready with provided token");
                return;
            }

            // Determine if we're using new or old format
            const isNewFormat = roomId && toUserIds && fromUsername;

            let requestBody: any;

            if (isNewFormat) {
                // New calling format - will trigger incoming call notifications
                requestBody = {
                    roomId,
                    toUserIds,
                    toUsernames: toUsernames || {},
                    isVideo: isVideo || false,
                    fromUsername,
                    groupName: groupName || null,
                    isJoiningOngoingCall: isJoiningOngoingCall || false, // Flag to prevent duplicate notifications when joining ongoing calls
                };

                console.log("🚀 Starting NEW FORMAT LiveKit call:", {
                    roomId,
                    toUserIds,
                    toUsernames,
                    isVideo,
                    fromUsername,
                    groupName,
                    isJoiningOngoingCall,
                    participantCount: toUserIds.length,
                });
            } else {
                // Old format for backward compatibility
                requestBody = {
                    roomName,
                    participantName,
                };

                console.log("🔄 Starting OLD FORMAT LiveKit call:", {
                    roomName,
                    participantName,
                    testMode,
                });
            }

            // Get room token and E2EE key from backend
            const response = await fetch(CREATE_ROOM_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                // Handle specific error codes from the backend
                if (response.status === 409) {
                    try {
                        const errorData = await response.json();
                        if (errorData.code === "ALREADY_IN_CALL") {
                            throw new Error(`ALREADY_IN_CALL:${JSON.stringify(errorData)}`);
                        }
                    } catch (parseError) {
                        // If we can't parse the error, fall back to generic error
                        console.warn("Failed to parse 409 error response:", parseError);
                    }
                }
                throw new Error(`Failed to create room: ${response.statusText}`);
            }

            const responseData: RoomResponse = await response.json();
            const { token: roomToken, serverUrl: roomServerUrl, e2eeKey, participants } = responseData;

            // Validate server URL format
            if (!roomServerUrl.startsWith("ws://") && !roomServerUrl.startsWith("wss://")) {
                throw new Error("Invalid server URL format. Must start with ws:// or wss://");
            }

            if (isNewFormat) {
                console.log("✅ NEW FORMAT call created successfully:", {
                    serverUrl: roomServerUrl,
                    tokenLength: roomToken.length,
                    hasE2eeKey: !!e2eeKey,
                    participantCount: participants?.length || 0,
                    onlineParticipants: participants?.filter((p) => p.isOnline).length || 0,
                });
            } else {
                console.log("✅ OLD FORMAT connection ready:", {
                    serverUrl: roomServerUrl,
                    tokenLength: roomToken.length,
                    testMode: testMode ? "🧪 ACTIVE" : "Normal",
                });
            }

            // Create basic room options (E2EE can be added later when imports are fixed)
            // const options: RoomOptions = {
            //     publishDefaults: {
            //         simulcast: false,
            //     },
            //     adaptiveStream: false,
            //     dynacast: false,
            // };
            const keyProvider = new ExternalE2EEKeyProvider();
            await keyProvider.setKey(e2eeKey);

            // Create E2EE worker
            const worker = new Worker(new URL("../workers/e2ee.worker.ts", import.meta.url), { type: "module" });

            worker.onerror = (error) => {
                console.error("E2EE Worker error:", error);
                setError("Failed to initialize E2EE worker");
            };

            worker.onmessage = (event) => {
                console.log("E2EE Worker message:", event.data);
            };

            // Create room options with E2EE configuration
            const options: RoomOptions = {
                e2ee: {
                    keyProvider,
                    worker,
                },
                publishDefaults: {
                    simulcast: true, // Enable simulcast for better network adaptability
                },
                adaptiveStream: true, // Enable adaptive streaming
                dynacast: true, // Enable dynamic video quality adjustment
                reconnectAttempts: 3, // Allow 3 reconnection attempts
                stopLocalTrackOnUnpublish: false, // Keep local tracks alive during temporary disconnects
            };

            // Store connection details and options
            setToken(roomToken);
            setServerUrl(roomServerUrl);
            setRoomOptions(options);
        } catch (err) {
            console.error("❌ Connection error:", err);

            // Handle specific error types for graceful degradation
            if (err instanceof Error) {
                const errorMessage = err.message;

                // Handle "Already in Call" error
                if (errorMessage.startsWith("ALREADY_IN_CALL:")) {
                    try {
                        const errorDataStr = errorMessage.substring("ALREADY_IN_CALL:".length);
                        const errorData = JSON.parse(errorDataStr);

                        // Show a nice toast notification to the user
                        showToast(
                            "You are already in an active call. Please end your current call before starting a new one.",
                            "warning",
                            5000,
                        );

                        // Set a more user-friendly error message
                        setError(
                            "You are already in an active call on another device. Please end your current call first.",
                        );

                        console.log("❌ User attempted to start a new call while already in an active call:", {
                            activeCallRoomId: errorData.activeCallRoomId,
                            activeCallStartTime: errorData.activeCallStartTime,
                            userMessage: errorData.error,
                        });

                        return;
                    } catch (parseError) {
                        console.warn("Failed to parse ALREADY_IN_CALL error data:", parseError);
                        // Fall back to generic handling
                    }
                }

                const errorMessageLower = errorMessage.toLowerCase();

                // Handle ICE connection failures
                if (
                    errorMessageLower.includes("ice") ||
                    errorMessageLower.includes("could not establish pc connection")
                ) {
                    console.log("🔄 ICE connection issue detected - attempting to recover");
                    // Don't set error immediately, let reconnection logic handle it
                    return;
                }

                // Handle media device errors
                if (errorMessageLower.includes("getusermedia") || errorMessageLower.includes("device")) {
                    setError("Media device access error. Please check your camera and microphone permissions.");
                    return;
                }

                // Handle network errors
                if (errorMessageLower.includes("network") || errorMessageLower.includes("connection")) {
                    setError("Network connection issue. Please check your internet connection.");
                    return;
                }

                setError(err.message);
            } else {
                setError("Failed to connect to room");
            }
        } finally {
            setIsConnecting(false);
            connectionInProgress.current = false;
        }
    }, [roomName, participantName, roomId, toUserIds, toUsernames, isVideo, fromUsername, groupName, testMode]);

    const checkRoom = useCallback(async (): Promise<RoomResponse | null> => {
        try {
            // First, get the room token to check actual LiveKit room state
            const isNewFormat = roomId && toUserIds && fromUsername;

            let requestBody: any;

            if (isNewFormat) {
                requestBody = {
                    roomId,
                    toUserIds,
                    toUsernames: toUsernames || {},
                    isVideo: isVideo || false,
                    fromUsername,
                    groupName: groupName || null,
                    checkOnly: true, // Flag to get token without triggering notifications
                };
            } else {
                requestBody = {
                    roomName,
                    participantName,
                    checkOnly: true,
                };
            }

            // Get room token and server URL
            const response = await fetch(CREATE_ROOM_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                return null;
            }

            const responseData: RoomResponse = await response.json();
            const { token: checkToken, serverUrl: checkServerUrl } = responseData;

            // Now check actual LiveKit room for connected participants using Room.connect with minimal config
            console.log("🔍 Checking actual LiveKit room state...");

            try {
                // Use dynamic import to avoid issues with LiveKit imports
                const { Room } = await import("livekit-client");

                const tempRoom = new Room({
                    publishDefaults: { simulcast: false },
                    adaptiveStream: false,
                });

                // Connect briefly to check room state with timeout
                const connectPromise = tempRoom.connect(checkServerUrl, checkToken);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Room check timeout")), 5000),
                );

                await Promise.race([connectPromise, timeoutPromise]);

                // Wait a moment for room state to stabilize
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Get actual participants (excluding ourselves)
                const actualParticipants = Array.from(tempRoom.remoteParticipants.values());
                const connectedCount = actualParticipants.length;

                console.log(`🎯 LiveKit room check: Found ${connectedCount} actual connected participants`);
                console.log(
                    `🎯 Participant details:`,
                    actualParticipants.map((p) => ({
                        identity: p.identity,
                        name: p.name,
                        connectionState: p.connectionState,
                    })),
                );

                // Clean up: Immediately disconnect our check connection
                tempRoom.disconnect();

                if (connectedCount > 0) {
                    // There are actual connected participants - this is an ongoing call
                    console.log("✅ Confirmed ongoing call with real connected participants");
                    return {
                        ...responseData,
                        participants: actualParticipants.map((p) => ({
                            userId: p.identity,
                            username: p.name || p.identity,
                            isOnline: true,
                        })),
                    };
                } else {
                    // No actual connected participants - this is a new call
                    console.log("✅ No connected participants found - this is a new call");
                    return null;
                }
            } catch (livekitError) {
                console.warn("⚠️ Failed to check LiveKit room state:", livekitError);
                // If we can't check LiveKit state, assume it's a new call to avoid false positives
                return null;
            }
        } catch (err) {
            console.warn("Failed to check room status:", err);
            return null;
        }
    }, [roomName, participantName, roomId, toUserIds, toUsernames, isVideo, fromUsername, groupName]);

    return {
        token,
        serverUrl,
        error,
        isConnecting,
        connect,
        checkRoom,
        roomOptions,
    };
};
