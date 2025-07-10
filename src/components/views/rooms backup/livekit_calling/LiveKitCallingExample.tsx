/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";

import { VideoRoom } from "./VideoRoom";

interface LiveKitCallingExampleProps {
    roomId: string;
    userId: string;
}

export const LiveKitCallingExample: React.FC<LiveKitCallingExampleProps> = ({ roomId, userId }) => {
    const [isInCall, setIsInCall] = useState(false);
    const [testMode, setTestMode] = useState<{
        useWrongKey?: boolean;
        customKey?: string;
    }>({});

    const handleJoinCall = (): void => {
        setIsInCall(true);
    };

    const handleLeaveCall = (): void => {
        setIsInCall(false);
    };

    const handleTestModeChange = (mode: typeof testMode): void => {
        setTestMode(mode);
    };

    if (!isInCall) {
        return (
            <div className="livekit-calling-lobby">
                <h2>Join LiveKit Call</h2>
                <p>Room: {roomId}</p>
                <p>User: {userId}</p>

                {/* Test Mode Controls */}
                <div className="test-mode-controls">
                    <h3>🧪 E2EE Test Mode</h3>
                    <label>
                        <input
                            type="checkbox"
                            checked={testMode.useWrongKey || false}
                            onChange={(e) =>
                                handleTestModeChange({
                                    ...testMode,
                                    useWrongKey: e.target.checked,
                                })
                            }
                        />
                        Use wrong E2EE key (for testing)
                    </label>
                    <br />
                    <label>
                        Custom E2EE key:
                        <input
                            type="text"
                            value={testMode.customKey || ""}
                            onChange={(e) =>
                                handleTestModeChange({
                                    ...testMode,
                                    customKey: e.target.value,
                                })
                            }
                            placeholder="Enter custom key for testing"
                        />
                    </label>
                </div>

                <button onClick={handleJoinCall} className="join-call-button">
                    Join Call
                </button>
            </div>
        );
    }

    return (
        <div className="livekit-calling-container">
            <div className="call-header">
                <h2>LiveKit Call - {roomId}</h2>
                <button onClick={handleLeaveCall} className="leave-call-button">
                    Leave Call
                </button>
            </div>

            <VideoRoom roomName={roomId} participantName={userId} testMode={testMode} />
        </div>
    );
};
