/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useEffect } from "react";

import LiveKitRoomManager from "../livekit-calling/LiveKitRoomManager";

interface GlobalCallUIManagerProps {
    // This component doesn't need props as it manages its own state globally
}

/**
 * GlobalCallUIManager handles rendering call UI regardless of which page the user is on.
 * This ensures incoming calls work from any location in the app.
 */
export const GlobalCallUIManager: React.FC<GlobalCallUIManagerProps> = () => {
    const [activeCallData, setActiveCallData] = useState<any>(null);

    useEffect(() => {
        console.log("🌍 GlobalCallUIManager: Setting up global call UI handlers");

        // Listen for globally accepted calls
        const handleGlobalCallAccepted = (event: Event): void => {
            const customEvent = event as CustomEvent;
            const callData = customEvent.detail;

            console.log("🌍 GlobalCallUIManager: Received global call accepted event", callData);

            if (callData) {
                console.log("🌍 Setting up global call UI for accepted call");
                setActiveCallData(callData);

                // Hide the main app content when call is active
                document.body.classList.add("mx_GlobalCall_active");
            }
        };

        // Listen for call ended events to clean up
        const handleGlobalCallEnded = (event: Event): void => {
            const customEvent = event as CustomEvent;

            console.log("🌍 GlobalCallUIManager: Call ended, cleaning up global UI");
            setActiveCallData(null);

            // Show the main app content again
            document.body.classList.remove("mx_GlobalCall_active");
        };

        // Add event listeners
        window.addEventListener("globalCallAccepted", handleGlobalCallAccepted);
        window.addEventListener("liveKitCallEnded", handleGlobalCallEnded);

        // Cleanup function
        return () => {
            window.removeEventListener("globalCallAccepted", handleGlobalCallAccepted);
            window.removeEventListener("liveKitCallEnded", handleGlobalCallEnded);

            // Make sure to clean up body class
            document.body.classList.remove("mx_GlobalCall_active");
        };
    }, []);

    // Handle closing the call
    const handleCloseCall = (): void => {
        console.log("🌍 GlobalCallUIManager: Closing call");

        setActiveCallData(null);

        // Show the main app content again
        document.body.classList.remove("mx_GlobalCall_active");

        // Dispatch call ended event for other components
        const callEndedEvent = new CustomEvent("liveKitCallEnded", {
            detail: { source: "GlobalCallUIManager" },
        });
        window.dispatchEvent(callEndedEvent);
    };

    // Monitor activeCallData changes
    useEffect(() => {
        console.log("🌍 GlobalCallUIManager: activeCallData changed:", activeCallData);
        if (activeCallData) {
            console.log("✅ Global call UI will render");
        } else {
            console.log("❌ Global call UI hidden");
        }
    }, [activeCallData]);

    // Only render if we have active call data
    if (!activeCallData) {
        return null;
    }

    // LiveKitRoomManager already creates its own portal and handles full-screen rendering
    // No need for additional overlay
    return <LiveKitRoomManager callData={activeCallData} isActive={!!activeCallData} onClose={handleCloseCall} />;
};

export default GlobalCallUIManager;
