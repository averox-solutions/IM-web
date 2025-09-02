/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState, useCallback } from "react";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";

interface IncomingCallData {
    roomId: string;
    fromUserId: string;
    fromUsername: string;
    isVideo: boolean;
    participants: any;
    isGroup: boolean;
    groupName?: string;
    callLogId: string;
    token: string;
    serverUrl: string;
    e2eeKey?: string;
}

interface IncomingLiveKitCallModalProps {
    callData: IncomingCallData;
    onAccept: (callData: IncomingCallData) => void;
    onReject: (callData: IncomingCallData) => void;
    onClose: () => void;
}

export const IncomingLiveKitCallModal: React.FC<IncomingLiveKitCallModalProps> = ({
    callData,
    onAccept,
    onReject,
    onClose,
}) => {
    const [timeElapsed, setTimeElapsed] = useState(0);

    const handleAccept = (): void => {
        console.log("✅ Accepting LiveKit call:", callData);
        onAccept(callData);
        onClose();
    };

    const handleReject = useCallback((): void => {
        console.log("❌ Rejecting LiveKit call:", callData);
        onReject(callData);
        onClose();
    }, [callData, onReject, onClose]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeElapsed((prev) => prev + 1);
        }, 1000);

        // Auto-close after 30 seconds
        const timeout = setTimeout(() => {
            console.log("📞 Auto-rejecting call after 30 seconds");
            handleReject();
        }, 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [handleReject]);

    const caller = callData.isGroup ? callData.groupName : callData.fromUsername;
    const callType = callData.isVideo ? "Video" : "Voice";

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                zIndex: 15000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleReject();
                }
            }}
        >
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    padding: "30px",
                    maxWidth: "400px",
                    width: "90%",
                    textAlign: "center",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Call Type Icon */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: "20px",
                    }}
                >
                    <div
                        style={{
                            backgroundColor: callData.isVideo ? "#4285f4" : "#34a853",
                            borderRadius: "50%",
                            width: "80px",
                            height: "80px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {callData.isVideo ? (
                            <VideoCallIcon style={{ fontSize: "40px", color: "white" }} />
                        ) : (
                            <VoiceCallIcon style={{ fontSize: "40px", color: "white" }} />
                        )}
                    </div>
                </div>

                {/* Caller Info */}
                <h2
                    style={{
                        margin: "0 0 10px 0",
                        fontSize: "24px",
                        fontWeight: "600",
                        color: "#1a1a1a",
                    }}
                >
                    Incoming {callType} Call
                </h2>

                <p
                    style={{
                        margin: "0 0 20px 0",
                        fontSize: "18px",
                        color: "#666",
                        fontWeight: "500",
                    }}
                >you
                    {caller} is calling 
                </p>

                {/* Call Details */}
                <div
                    style={{
                        backgroundColor: "#f5f5f5",
                        borderRadius: "8px",
                        padding: "15px",
                        marginBottom: "25px",
                        fontSize: "14px",
                        color: "#666",
                    }}
                >
                    <div style={{ marginBottom: "5px" }}>
                        <strong>Room:</strong> {callData.roomId}
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                        <strong>Type:</strong> {callType} Call
                    </div>
                    {callData.isGroup && (
                        <div style={{ marginBottom: "5px" }}>
                            <strong>Group:</strong> {callData.groupName}
                        </div>
                    )}
                    <div style={{ marginBottom: "5px" }}>
                        <strong>E2EE:</strong> {callData.e2eeKey ? "🔒 Enabled" : "❌ Disabled"}
                    </div>
                    <div>
                        <strong>Duration:</strong> {timeElapsed}s
                    </div>
                </div>

                {/* Action Buttons */}
                <div
                    style={{
                        display: "flex",
                        gap: "15px",
                        justifyContent: "center",
                    }}
                >
                    {/* Reject Button */}
                    <button
                        onClick={handleReject}
                        style={{
                            backgroundColor: "#ea4335",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "60px",
                            height: "60px",
                            fontSize: "24px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s ease",
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "#d33b2c";
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "#ea4335";
                        }}
                        title="Reject call"
                    >
                        ✕
                    </button>

                    {/* Accept Button */}
                    <button
                        onClick={handleAccept}
                        style={{
                            backgroundColor: "#34a853",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "60px",
                            height: "60px",
                            fontSize: "24px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s ease",
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "#2d8f47";
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "#34a853";
                        }}
                        title="Accept call"
                    >
                        ✓
                    </button>
                </div>

                {/* Timeout Warning */}
                {timeElapsed > 20 && (
                    <p
                        style={{
                            marginTop: "15px",
                            fontSize: "12px",
                            color: "#ea4335",
                            fontStyle: "italic",
                        }}
                    >
                        Call will auto-reject in {30 - timeElapsed} seconds
                    </p>
                )}
            </div>
        </div>
    );
};

export default IncomingLiveKitCallModal;
