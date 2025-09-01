/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useEffect } from "react";
import ReactDOM from "react-dom";

import { VideoRoom } from "./VideoRoom";

interface LiveKitCallData {
    roomId: string;
    participantName: string;
    token: string;
    serverUrl: string;
    e2eeKey?: string;
    callType: "video" | "voice";
    isIncoming?: boolean;
}

interface LiveKitRoomManagerProps {
    callData: LiveKitCallData;
    isActive: boolean;
    onClose: () => void;
}

export const LiveKitRoomManager: React.FC<LiveKitRoomManagerProps> = ({ callData, isActive, onClose }) => {
    const connectionInitiated = useRef(false);

    useEffect(() => {
        if (isActive && !connectionInitiated.current) {
            connectionInitiated.current = true;
            console.log("🚀 Starting LiveKit room with provided token:", {
                roomId: callData.roomId,
                participantName: callData.participantName,
                serverUrl: callData.serverUrl,
                tokenLength: callData.token.length,
                hasE2eeKey: !!callData.e2eeKey,
                callType: callData.callType,
                isIncoming: callData.isIncoming,
            });
        }
    }, [isActive, callData]);

    // Set call active state when LiveKitRoomManager is active
    useEffect(() => {
        if (isActive) {
            // Set call as active when LiveKitRoomManager becomes active
            if ((window as any).setCallActiveState) {
                (window as any).setCallActiveState(true);
                console.log("📞 LiveKitRoomManager: Set call active state to TRUE");
            } else {
                console.warn("⚠️ LiveKitRoomManager: setCallActiveState function not available");
            }
        } else {
            // Clear call state when LiveKitRoomManager becomes inactive
            if ((window as any).setCallActiveState) {
                (window as any).setCallActiveState(false);
                console.log("📞 LiveKitRoomManager: Set call active state to FALSE (inactive)");
            }
        }

        // Cleanup when component unmounts
        return () => {
            if ((window as any).setCallActiveState) {
                (window as any).setCallActiveState(false);
                console.log("📞 LiveKitRoomManager: Set call active state to FALSE on unmount");
            }
        };
    }, [isActive]);

    if (!isActive) {
        return null;
    }

    return ReactDOM.createPortal(
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.95)",
                zIndex: 20000, // Higher than sidebar and all other components
                display: "flex",
                flexDirection: "column",
                width: "100vw",
                height: "100vh",
            }}
        >
            {/* LiveKit VideoRoom Component with provided token - Full Screen */}
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                <LiveKitVideoRoomWithToken
                    roomId={callData.roomId}
                    participantName={callData.participantName}
                    token={callData.token}
                    serverUrl={callData.serverUrl}
                    e2eeKey={callData.e2eeKey}
                    callType={callData.callType}
                    onLeave={onClose}
                />
            </div>
        </div>,
        document.body, // Render at document.body level
    );
};

interface LiveKitVideoRoomWithTokenProps {
    roomId: string;
    participantName: string;
    token: string;
    serverUrl: string;
    e2eeKey?: string;
    callType: "video" | "voice";
    onLeave: () => void;
}

const LiveKitVideoRoomWithToken: React.FC<LiveKitVideoRoomWithTokenProps> = ({
    roomId,
    participantName,
    token,
    serverUrl,
    e2eeKey,
    callType,
    onLeave,
}) => {
    const connectionInitiated = useRef(false);

    // We need to create a custom useRoom hook implementation that uses the provided token
    const roomData = {
        token,
        serverUrl,
        error: "",
        isConnecting: false,
        connect: async () => {
            // No need to connect as we already have the token
            console.log("✅ Using provided token for LiveKit connection");
        },
        roomOptions: {
            publishDefaults: {
                simulcast: false,
            },
            adaptiveStream: false,
            dynacast: false,
            // E2EE can be added here when the exports are fixed
        },
    };

    useEffect(() => {
        if (!connectionInitiated.current) {
            connectionInitiated.current = true;
            console.log("🔗 Initializing LiveKit room with token:", {
                roomId,
                participantName,
                serverUrl,
                tokenPreview: token.substring(0, 20) + "...",
                hasE2eeKey: !!e2eeKey,
                callType,
            });
        }
    }, [roomId, participantName, token, serverUrl, e2eeKey, callType]);

    return (
        <VideoRoomWithProvidedToken
            roomId={roomId}
            participantName={participantName}
            roomData={roomData}
            callType={callType}
            testMode={{
                useWrongKey: false,
                customKey: e2eeKey,
            }}
            onLeave={onLeave}
        />
    );
};

// Custom VideoRoom component that accepts pre-provided connection data
interface VideoRoomWithProvidedTokenProps {
    roomId: string;
    participantName: string;
    roomData: {
        token: string;
        serverUrl: string;
        error: string;
        isConnecting: boolean;
        connect: () => Promise<void>;
        roomOptions: any;
    };
    callType: "video" | "voice";
    testMode?: {
        useWrongKey?: boolean;
        customKey?: string;
    };
    onLeave: () => void;
}

const VideoRoomWithProvidedToken: React.FC<VideoRoomWithProvidedTokenProps> = ({
    roomId,
    participantName,
    roomData,
    testMode,
    onLeave,
    callType,
}) => {
    console.log("🎬 VideoRoomWithProvidedToken: Using token-based connection", {
        roomId,
        participantName,
        tokenPreview: roomData.token.substring(0, 20) + "...",
        serverUrl: roomData.serverUrl,
        callType,
    });

    // For incoming calls, we need to use the special token-based mode
    // Extract additional call data from globalActiveCallData for proper props
    const globalActiveCallData = (window as any).__globalActiveCallData;
    const incomingCallData = (window as any).__incomingCallData;

    console.log("🎬 VideoRoomWithProvidedToken: Extracting call metadata", {
        globalActiveCallData,
        incomingCallData,
    });

    // Try to get additional call metadata from stored data
    const callMetadata = incomingCallData || {};

    return (
        <VideoRoom
            roomName={roomId}
            participantName={participantName}
            roomId={roomId} // Pass roomId explicitly
            toUserIds={callMetadata.toUserIds || []}
            toUsernames={callMetadata.toUsernames || {}}
            fromUsername={callMetadata.fromUsername}
            groupName={callMetadata.groupName}
            isVideo={callType === "video"}
            isAcceptingIncomingCall={true} // Flag to indicate this is an incoming call
            testMode={{
                ...testMode,
                useProvidedToken: true, // Custom flag to use provided token
                providedToken: roomData.token,
                providedServerUrl: roomData.serverUrl,
            }}
            onLeave={onLeave}
        />
    );
};

export default LiveKitRoomManager;
