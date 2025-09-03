/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, useState } from "react";

import {
    ParticipantTile,
    ControlBar,
    LiveKitRoom,
    useRoomContext,
    useParticipants,
    useTracks,
} from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";
import "@livekit/components-styles";

import { useRoom } from "./hooks/useRoom";
import GlobalSocketManager from "../Calling/GlobalSocketManager";
import { getCurrentMatrixUserId } from "../Calling/MatrixUtils";
import { CALL_ENDED, USER_LEFT_CALL } from "../Calling/socketEvents";

// Helper function to ensure socket is ready before emitting events
const ensureSocketReady = async (maxRetries = 5, delayMs = 1000): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const socket = GlobalSocketManager.getGlobalSocket();
        const userId = getCurrentMatrixUserId();

        if (socket && socket.connected && userId) {
            return { socket, userId };
        }

        console.log(`🔌 Socket not ready (attempt ${attempt + 1}/${maxRetries}):`, {
            hasSocket: !!socket,
            isConnected: socket?.connected,
            hasUserId: !!userId,
        });

        if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    throw new Error(`Socket not ready after ${maxRetries} attempts`);
};

// Utility function to emit call ended event to backend with robust retry logic
const emitCallEndedEvent = async (roomId: string, toUserIds: string[]): Promise<void> => {
    try {
        console.log("🚀 emitCallEndedEvent called with:", { roomId, toUserIds });

        // Ensure socket is ready before proceeding
        const { socket, userId: fromUserId } = await ensureSocketReady();

        const callEndedData = {
            roomId,
            initiatorUserId: fromUserId,
            participantIds: toUserIds || [],
        };

        console.log("📤 Emitting CALL_ENDED event to backend via global socket:", callEndedData);
        socket.emit(CALL_ENDED, callEndedData);
        console.log("✅ CALL_ENDED event emitted successfully via global socket");
    } catch (error) {
        console.error("💥 Failed to emit call ended event:", error);

        // Fallback: try once more with the old method as a last resort
        console.log("🔄 Attempting fallback emission...");
        const socket = GlobalSocketManager.getGlobalSocket();
        const fromUserId = getCurrentMatrixUserId();

        if (socket && fromUserId) {
            try {
                const callEndedData = {
                    roomId,
                    initiatorUserId: fromUserId,
                    participantIds: toUserIds || [],
                };
                socket.emit(CALL_ENDED, callEndedData);
                console.log("✅ CALL_ENDED event emitted via fallback method");
            } catch (fallbackError) {
                console.error("💥 Fallback emission also failed:", fallbackError);
            }
        } else {
            console.error("❌ Fallback failed: socket or userId not available");
        }
    }
};

// Utility function to emit user left call event to backend with robust retry logic
const emitUserLeftCallEvent = async (roomId: string): Promise<void> => {
    try {
        console.log("🚀 emitUserLeftCallEvent called with:", { roomId });

        // Ensure socket is ready before proceeding
        const { socket, userId } = await ensureSocketReady();

        const userLeftData = {
            roomId,
            userId,
        };

        console.log("📤 Emitting USER_LEFT_CALL event to backend via global socket:", userLeftData);
        socket.emit(USER_LEFT_CALL, userLeftData);
        console.log("✅ USER_LEFT_CALL event emitted successfully via global socket");
    } catch (error) {
        console.error("💥 Failed to emit user left call event:", error);

        // Fallback: try once more with the old method as a last resort
        console.log("🔄 Attempting fallback emission...");
        const socket = GlobalSocketManager.getGlobalSocket();
        const userId = getCurrentMatrixUserId();

        if (socket && userId) {
            try {
                const userLeftData = { roomId, userId };
                socket.emit(USER_LEFT_CALL, userLeftData);
                console.log("✅ USER_LEFT_CALL event emitted via fallback method");
            } catch (fallbackError) {
                console.error("💥 Fallback emission also failed:", fallbackError);
            }
        } else {
            console.error("❌ Fallback failed: socket or userId not available");
        }
    }
};

// Add CSS to hide sidebar and other UI elements during LiveKit calls
const livekitCallStyles = `
    .mx_LiveKitCall_active .mx_LeftPanel,
    .mx_LiveKitCall_active .mx_RightPanel,
    .mx_LiveKitCall_active .mx_HeaderWrapper,
    .mx_LiveKitCall_active .mx_ResizeHandle {
        display: none !important;
    }
    
    .mx_LiveKitCall_active .mx_RoomView {
        margin: 0 !important;
        padding: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
    }
    
    .mx_LiveKitCall_active {
        overflow: hidden;
    }

    /* Professional Video Flex Layout - Responsive Design */
    .lk-video-grid {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 16px !important;
        padding: 20px !important;
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        align-content: flex-start !important;
        justify-content: center !important;
        flex: 1 !important;
        background: #1a1a1a url('/img/Call-wallpaper.jpg') center/cover no-repeat !important;
        background-blend-mode: overlay !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        align-items: flex-start !important;
        aspect-ratio: 16 / 9 !important;
    }

    /* Ensure video grid maintains aspect ratio */
    .professional-video-room {
        aspect-ratio: 16 / 9 !important;
        width: 100% !important;
        height: auto !important;
        max-height: 100vh !important;
        display: flex !important;
        flex-direction: column !important;
    }

    /* Center placeholder when no participants */
    .lk-video-grid:empty,
    .lk-video-grid[data-participant-count="0"] {
        align-content: center !important;
        align-items: center !important;
        justify-content: center !important;
    }

    /* Dynamic sizing based on participant count using CSS custom properties */
    .lk-video-grid[data-participant-count="1"] {
        --tile-width: min(80vw, 600px);
        --tile-height: min(60vh, 450px);
        --name-font-size: 16px;
        --name-padding: 8px 16px;
        align-content: center !important;
        align-items: center !important;
    }

    .lk-video-grid[data-participant-count="2"] {
        --tile-width: min(45vw, 400px);
        --tile-height: min(50vh, 350px);
        --name-font-size: 14px;
        --name-padding: 6px 14px;
        align-content: center !important;
        align-items: center !important;
    }

    .lk-video-grid[data-participant-count="3"] {
        --tile-width: min(30vw, 320px);
        --tile-height: min(35vh, 280px);
        --name-font-size: 13px;
        --name-padding: 6px 12px;
        align-content: center !important;
        align-items: center !important;
    }

    .lk-video-grid[data-participant-count="4"] {
        --tile-width: min(40vw, 320px);
        --tile-height: min(35vh, 240px);
        --name-font-size: 12px;
        --name-padding: 5px 12px;
        align-content: center !important;
        align-items: center !important;
    }

    .lk-video-grid[data-participant-count="5"],
    .lk-video-grid[data-participant-count="6"] {
        --tile-width: min(30vw, 280px);
        --tile-height: min(30vh, 200px);
        --name-font-size: 11px;
        --name-padding: 4px 10px;
    }

    .lk-video-grid[data-participant-count="7"],
    .lk-video-grid[data-participant-count="8"],
    .lk-video-grid[data-participant-count="9"] {
        --tile-width: min(28vw, 250px);
        --tile-height: min(25vh, 180px);
        --name-font-size: 10px;
        --name-padding: 4px 8px;
    }

    .lk-video-grid[data-participant-count="10"],
    .lk-video-grid[data-participant-count="11"],
    .lk-video-grid[data-participant-count="12"] {
        --tile-width: min(22vw, 220px);
        --tile-height: min(20vh, 160px);
        --name-font-size: 10px;
        --name-padding: 3px 8px;
    }

    /* For more than 12 participants */
    .lk-video-grid[data-participant-count]:not([data-participant-count="1"]):not([data-participant-count="2"]):not([data-participant-count="3"]):not([data-participant-count="4"]):not([data-participant-count="5"]):not([data-participant-count="6"]):not([data-participant-count="7"]):not([data-participant-count="8"]):not([data-participant-count="9"]):not([data-participant-count="10"]):not([data-participant-count="11"]):not([data-participant-count="12"]) {
        --tile-width: min(18vw, 180px);
        --tile-height: min(15vh, 130px);
        --name-font-size: 9px;
        --name-padding: 3px 6px;
    }

    /* Mobile responsive adjustments */
    @media (max-width: 768px) {
        .lk-video-grid {
            gap: 8px !important;
            padding: 12px !important;
        }

        .lk-video-grid[data-participant-count="1"] {
            --tile-width: 90vw;
            --tile-height: 50vh;
            --name-font-size: 14px;
        }

        .lk-video-grid[data-participant-count="2"] {
            --tile-width: 85vw;
            --tile-height: 35vh;
            --name-font-size: 12px;
            flex-direction: column !important;
        }

        .lk-video-grid[data-participant-count="3"],
        .lk-video-grid[data-participant-count="4"] {
            --tile-width: 42vw;
            --tile-height: 25vh;
            --name-font-size: 10px;
        }

        /* For 5+ participants on mobile, use smaller tiles */
        .lk-video-grid[data-participant-count]:not([data-participant-count="1"]):not([data-participant-count="2"]):not([data-participant-count="3"]):not([data-participant-count="4"]) {
            --tile-width: 40vw;
            --tile-height: 20vh;
            --name-font-size: 9px;
            --name-padding: 2px 6px;
        }
    }

    @media (max-width: 480px) {
        .lk-video-grid[data-participant-count]:not([data-participant-count="1"]):not([data-participant-count="2"]) {
            --tile-width: 38vw;
            --tile-height: 18vh;
            --name-font-size: 8px;
            --name-padding: 2px 4px;
        }
    }

    /* Clean Video Tile Styling with Dynamic Sizing */
    .lk-participant-tile {
        background: transparent !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        position: relative !important;
        box-shadow: none !important;
        border: none !important;
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        /* Use CSS custom properties for dynamic sizing */
        width: var(--tile-width, 300px) !important;
        height: var(--tile-height, 200px) !important;
        min-width: var(--tile-width, 300px) !important;
        min-height: var(--tile-height, 200px) !important;
        max-width: var(--tile-width, 300px) !important;
        max-height: var(--tile-height, 200px) !important;
        flex-shrink: 0 !important;
        z-index: 1 !important;
        contain: layout style paint !important;
        display: flex !important;
        flex-direction: column !important;
        aspect-ratio: 16 / 9 !important;
    }

    /* Video container styling */
    .lk-participant-video-container {
        aspect-ratio: 16 / 9 !important;
    }

    /* Video element styling */
    .lk-participant-tile video,
    .lk-participant-video-container video {
        object-fit: cover !important;
    }

    /* Ensure LiveKit's internal participant tile doesn't have conflicting positioning */
    .lk-participant-tile .lk-participant-tile {
        position: static !important;
        width: 100% !important;
        height: 100% !important;
    }

    /* Override any absolute positioning from LiveKit components */
    .lk-video-grid .lk-participant-tile,
    .lk-video-grid .lk-participant-tile > *,
    .lk-video-grid .lk-participant-tile .lk-participant-tile {
        position: relative !important;
    }

    /* Ensure video tracks display correctly within grid */
    .lk-video-grid .lk-participant-tile video,
    .lk-video-grid .lk-participant-tile canvas {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 8px !important;
    }

    /* Ensure video container has proper styling */
    .lk-participant-video-container video,
    .lk-participant-video-container canvas {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        background: transparent !important;
        border-radius: 8px !important;
    }

    .lk-participant-tile:hover {
        /* No hover effects for clean look */
    }

    /* Video element styling */
    .lk-participant-tile video {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        border-radius: 8px !important;
        background: transparent !important;
    }

    /* Mobile video optimization - ensure consistent display across devices */
    .lk-participant-tile video,
    .lk-participant-video-container video,
    .lk-video-grid video {
        /* Force consistent aspect ratio handling */
        object-fit: cover !important;
        object-position: center !important;
        
        /* Prevent mobile video from being too large or distorted */
        max-width: 100% !important;
        max-height: 100% !important;
        
        /* Ensure proper orientation handling */
        transform-origin: center !important;
        
        /* Prevent video scaling issues on mobile */
        width: 100% !important;
        height: 100% !important;
    }

    /* Mobile-specific video fixes */
    @media (max-width: 768px) {
        .lk-participant-tile video,
        .lk-participant-video-container video {
            /* More aggressive object-fit on mobile to prevent screen overflow */
            object-fit: cover !important;
            
            /* Prevent mobile browsers from auto-zooming videos */
            min-width: 100% !important;
            min-height: 100% !important;
            
            /* Lock aspect ratio */
            aspect-ratio: auto !important;
        }
    }

    /* Prevent mobile landscape issues */
    @media (max-width: 768px) and (orientation: landscape) {
        .lk-participant-tile video {
            /* Ensure landscape videos don't break the grid */
            object-fit: cover !important;
            max-height: 100% !important;
        }
    }

    /* Portrait mobile optimization */
    @media (max-width: 768px) and (orientation: portrait) {
        .lk-participant-tile video {
            /* Ensure portrait videos fit properly */
            object-fit: cover !important;
            max-width: 100% !important;
        }
    }

    /* Default: NO mirroring for all videos */
    .lk-video-grid video,
    .lk-participant-tile video,
    .lk-participant-video-container video,
    video {
        transform: none !important;
    }

    /* Override any LiveKit default mirroring for remote participants */
    .lk-participant-tile.remote-participant video,
    .lk-participant-tile[data-local="false"] video,
    .lk-video-grid .lk-participant-tile:not(.local-participant) video,
    .lk-video-grid .lk-participant-tile:not([data-local="true"]) video,
    .lk-video-grid .remote-participant video,
    [data-lk-local-participant="false"] video {
        transform: scaleX(-1) !important;
        -webkit-transform: scaleX(-1) !important;
        -moz-transform: scaleX(-1) !important;
        -ms-transform: scaleX(-1) !important;
        -o-transform: scaleX(-1) !important;
    }

    /* ONLY mirror local participant - highest specificity */
    .lk-video-grid .lk-participant-tile.local-participant video,
    .lk-video-grid .lk-participant-tile[data-local="true"] video,
    .lk-participant-tile.local-participant video,
    .lk-participant-tile[data-local="true"] video,
    [data-lk-local-participant="true"] video {
        transform: scaleX(-1) !important;
        -webkit-transform: scaleX(-1) !important;
        -moz-transform: scaleX(-1) !important;
        -ms-transform: scaleX(-1) !important;
        -o-transform: scaleX(-1) !important;
    }

    /* Video content container - takes up most space */
    .lk-participant-video-container {
        flex: 1 !important;
        position: relative !important;
        overflow: hidden !important;
        border-radius: 8px !important;
        background: transparent !important;
        margin: 0 !important;
    }

    /* Ensure the inner LiveKit participant tile fills the container */
    .lk-participant-video-container > .lk-participant-tile {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
    }

    /* Participant overlays container */
    .lk-participant-overlays {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 10 !important;
        display: flex !important;
        gap: 10px !important;
        flex-direction: row !important;
    }

    /* Speaking indicator overlay with responsive sizing */
    .lk-speaking-indicator {
        position: relative !important;
    }

    .speaking-ring {
        width: calc(var(--name-font-size, 12px) * 0.8) !important;
        height: calc(var(--name-font-size, 12px) * 0.8) !important;
        border: none !important;
        border-radius: 50% !important;
        background: #10b981 !important;
        backdrop-filter: none !important;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.6) !important;
        animation: speaking-pulse-dot 2s ease-in-out infinite !important;
    }

    /* Connection quality indicator - HIDDEN */
    .lk-connection-indicator {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    @keyframes speaking-pulse {
        0%, 100% {
            transform: scale(1) !important;
            opacity: 1 !important;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
        }
        50% {
            transform: scale(1.15) !important;
            opacity: 0.9 !important;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5) !important;
        }
    }

    @keyframes speaking-pulse-dot {
        0%, 100% {
            opacity: 1 !important;
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.6) !important;
        }
        50% {
            opacity: 0.7 !important;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.8) !important;
        }
    }

    /* Speaking participant tile highlighting */
    .lk-participant-tile.speaking {
        /* No speaking highlights for clean look */
    }

    /* Simple centered name bar at bottom with responsive sizing */
    .lk-participant-info-bar {
        position: absolute !important;
        bottom: 8px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgb(43 113 64 / 30%) !important;
        backdrop-filter: blur(8px) !important;
        border: none !important;
        /* Use CSS custom properties for responsive padding */
        padding: var(--name-padding, 4px 12px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: calc(var(--name-font-size, 12px) + 8px) !important;
        border-radius: calc(var(--name-font-size, 12px) + 4px) !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
        z-index: 10 !important;
        box-sizing: border-box !important;
        white-space: nowrap !important;
        max-width: calc(100% - 16px) !important;
        gap: 4px !important;
    }

    /* Participant name styling - centered with responsive font size */
    .lk-participant-name {
        color: white !important;
        /* Use CSS custom property for responsive font size */
        font-size: var(--name-font-size, 12px) !important;
        font-weight: 500 !important;
        text-overflow: ellipsis !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        text-align: center !important;
        margin: 0 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
        line-height: 1.2 !important;
    }

    /* Participant indicators container - shown with name */
    .lk-participant-indicators {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
    }

    /* Microphone muted indicator and other metadata with responsive sizing */
    .lk-participant-metadata {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: calc(var(--name-font-size, 12px) + 2px) !important;
        opacity: 0.9 !important;
        flex: 0 0 auto !important;
        flex-shrink: 0 !important;
        padding: 2px !important;
        min-width: calc(var(--name-font-size, 12px) + 4px) !important;
        text-align: center !important;
        position: relative !important;
        line-height: 1 !important;
        vertical-align: middle !important;
        line-height: 1 !important;
        vertical-align: middle !important;
    }

    .lk-participant-metadata.muted {
        color: #ff4444 !important;
        background: rgba(255, 68, 68, 0.2) !important;
        border: 1px solid rgba(255, 68, 68, 0.4) !important;
        border-radius: 3px !important;
        width: calc(var(--name-font-size, 12px) + 8px) !important;
        height: calc(var(--name-font-size, 12px) + 8px) !important;
        backdrop-filter: blur(4px) !important;
        font-size: calc(var(--name-font-size, 12px)) !important;
        flex-shrink: 0 !important;
        line-height: 1 !important;
    }

    .lk-participant-metadata.camera-off {
        color: #ffa502 !important;
        background: rgba(255, 165, 2, 0.3) !important;
        border-radius: 3px !important;
        width: calc(var(--name-font-size, 12px) + 8px) !important;
        height: calc(var(--name-font-size, 12px) + 8px) !important;
        backdrop-filter: blur(4px) !important;
        font-size: calc(var(--name-font-size, 12px)) !important;
        flex-shrink: 0 !important;
        line-height: 1 !important;
    }

    /* Control bar styling */
    .lk-control-bar {
        background: rgb(43 113 64 / 30%) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        padding: 12px 20px !important;
        gap: 12px !important;
        /* Fix z-index to ensure control bar appears above video grid */
        position: relative !important;
        z-index: 1000 !important;
        justify-content: center !important;
    }

    /* Ensure control bar container also has proper z-index */
    .lk-control-bar-container,
    .lk-control-bar-wrapper {
        position: relative !important;
        z-index: 1000 !important;
    }

    /* Override LiveKit's default control bar positioning */
    .lk-focus-layout .lk-control-bar,
    .lk-grid-layout .lk-control-bar {
        position: relative !important;
        z-index: 1000 !important;
    }

    /* Ensure any LiveKit control bar dropdowns also have proper z-index */
    .lk-control-bar .lk-dropdown,
    .lk-control-bar .lk-device-menu,
    .lk-control-bar .lk-menu {
        z-index: 1001 !important;
    }

    /* Fix any potential overflow issues that might hide the control bar */
    .professional-video-room {
        overflow: visible !important;
    }

    /* Ensure the main video container doesn't hide controls */
    .lk-video-grid {
        /* Reduce z-index of video grid to ensure control bar appears above */
        z-index: 1 !important;
    }

    /* Hide screen share button specifically - Multiple selectors to ensure it's hidden */
    .lk-control-bar .lk-button[data-lk-source="screen_share"],
    .lk-control-bar .lk-button[data-testid="button-screen-share"],
    .lk-control-bar .lk-button[title*="screen"],
    .lk-control-bar .lk-button[title*="Screen"],
    .lk-control-bar .lk-button[aria-label*="screen"],
    .lk-control-bar .lk-button[aria-label*="Screen"],
    .lk-control-bar button[title*="screen"],
    .lk-control-bar button[title*="Screen"],
    .lk-control-bar button[aria-label*="screen"],
    .lk-control-bar button[aria-label*="Screen"],
    .lk-control-bar [data-lk-button="screen_share"],
    .lk-control-bar [class*="screenshare"],
    .lk-control-bar [class*="ScreenShare"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Alternative approach - hide the third button which is typically screen share */
    .lk-control-bar > button:nth-child(3),
    .lk-control-bar > div:nth-child(3) > button,
    .lk-control-bar > *:nth-child(3) {
        display: none !important;
    }

    /* Hide dropdown arrows for microphone and video buttons */
    .lk-control-bar [data-lk-source="microphone"] .lk-device-selector-trigger,
    .lk-control-bar [data-lk-source="camera"] .lk-device-selector-trigger,
    .lk-control-bar .lk-device-selector-trigger,
    .lk-control-bar .lk-device-menu-trigger,
    .lk-control-bar .lk-button-menu,
    .lk-control-bar button[aria-label*="device"] .lk-chevron,
    .lk-control-bar button[aria-label*="microphone"] + button,
    .lk-control-bar button[aria-label*="camera"] + button,
    .lk-control-bar .lk-track-toggle + .lk-device-selector,
    .lk-control-bar .lk-track-toggle + button[aria-label*="device"],
    .lk-control-bar .lk-button + .lk-button[class*="device"],
    .lk-control-bar [class*="device-selector"],
    .lk-control-bar [class*="dropdown"],
    .lk-control-bar .lk-button + .lk-button-menu,
    .lk-control-bar [class*="menu"],
    .lk-control-bar [class*="Menu"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Additional specific targeting for button menus */
    .lk-button-menu,
    [class*="lk-button-menu"],
    .lk-control-bar > * > .lk-button-menu,
    .lk-control-bar .lk-button[aria-haspopup="true"] + *,
    .lk-control-bar .lk-button[aria-expanded="true"] + * {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Make disconnect/leave button more prominent with red styling */
    .lk-control-bar .lk-disconnect-button,
    .lk-control-bar .lk-button[data-lk-source="disconnect"],
    .lk-control-bar button[aria-label*="disconnect"],
    .lk-control-bar button[aria-label*="leave"],
    .lk-control-bar button[title*="disconnect"],
    .lk-control-bar button[title*="leave"],
    .lk-control-bar .lk-button:last-child {
        background: rgba(220, 53, 69, 0.9) !important;
        border-color: rgba(220, 53, 69, 1) !important;
        color: white !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3) !important;
    }

    .lk-control-bar .lk-disconnect-button:hover,
    .lk-control-bar .lk-button[data-lk-source="disconnect"]:hover,
    .lk-control-bar button[aria-label*="disconnect"]:hover,
    .lk-control-bar button[aria-label*="leave"]:hover,
    .lk-control-bar button[title*="disconnect"]:hover,
    .lk-control-bar button[title*="leave"]:hover,
    .lk-control-bar .lk-button:last-child:hover {
        background: rgba(220, 53, 69, 1) !important;
        border-color: rgba(220, 53, 69, 1) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4) !important;
    }

    /* Disabled state for disconnect/leave button when permissions aren't ready */
    .lk-control-bar .lk-disconnect-button.permissions-pending,
    .lk-control-bar .lk-button[data-lk-source="disconnect"].permissions-pending,
    .lk-control-bar button[aria-label*="disconnect"].permissions-pending,
    .lk-control-bar button[aria-label*="leave"].permissions-pending,
    .lk-control-bar button[title*="disconnect"].permissions-pending,
    .lk-control-bar button[title*="leave"].permissions-pending,
    .lk-control-bar .lk-button:last-child.permissions-pending {
        background: rgba(100, 100, 100, 0.5) !important;
        border-color: rgba(100, 100, 100, 0.7) !important;
        color: rgba(255, 255, 255, 0.5) !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
        opacity: 0.6 !important;
        box-shadow: none !important;
        transform: none !important;
    }

    .lk-control-bar .lk-disconnect-button.permissions-pending:hover,
    .lk-control-bar .lk-button[data-lk-source="disconnect"].permissions-pending:hover,
    .lk-control-bar button[aria-label*="disconnect"].permissions-pending:hover,
    .lk-control-bar button[aria-label*="leave"].permissions-pending:hover,
    .lk-control-bar button[title*="disconnect"].permissions-pending:hover,
    .lk-control-bar button[title*="leave"].permissions-pending:hover,
    .lk-control-bar .lk-button:last-child.permissions-pending:hover {
        background: rgba(100, 100, 100, 0.5) !important;
        border-color: rgba(100, 100, 100, 0.7) !important;
        transform: none !important;
        box-shadow: none !important;
    }

    .lk-button {
        background: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 12px !important;
        color: white !important;
        padding: 12px 16px !important;
        transition: all 0.3s ease !important;
        backdrop-filter: blur(10px) !important;
    }

    .lk-button:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
        transform: translateY(-1px) !important;
    }

    .lk-button.lk-button-danger {
        background: rgba(220, 53, 69, 0.8) !important;
        border-color: rgba(220, 53, 69, 1) !important;
    }

    .lk-button.lk-button-danger:hover {
        background: rgba(220, 53, 69, 1) !important;
    }

    /* Professional loading and connection states */
    .professional-loading {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100vh !important;
        background: linear-gradient(135deg, rgba(15, 15, 15, 0.85) 0%, rgba(26, 26, 26, 0.85) 100%), url('/img/Call-wallpaper.jpg') center/cover no-repeat !important;
        color: white !important;
        animation: fadeIn 0.3s ease-out !important;
    }

    @keyframes fadeIn {
        from {
            opacity: 0 !important;
            transform: translateY(20px) !important;
        }
        to {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    }

    /* Join call confirmation dialog styling */
    .professional-loading button {
        transition: all 0.3s ease !important;
    }

    .professional-loading button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    }

    .professional-loading button:active {
        transform: translateY(-1px) !important;
    }

    .loading-spinner {
        width: 40px !important;
        height: 40px !important;
        border: 3px solid rgba(255, 255, 255, 0.1) !important;
        border-top: 3px solid #4285f4 !important;
        border-radius: 50% !important;
        animation: spin 1s linear infinite !important;
        margin-bottom: 16px !important;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Status bar styling */
    .professional-status-bar {
        background: rgb(43 113 64 / 30%) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        padding: 10px 20px !important;
        color: white !important;
        font-size: 13px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        min-height: 50px !important;
        position: relative !important;
        z-index: 100 !important;
    }

    .status-indicator {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        font-size: 12px !important;
    }

    .status-indicator.e2ee-enabled {
        background: rgba(76, 175, 80, 0.2) !important;
        border-color: rgba(76, 175, 80, 0.4) !important;
        color: #81c784 !important;
    }

    .status-indicator.e2ee-disabled {
        background: rgba(244, 67, 54, 0.2) !important;
        border-color: rgba(244, 67, 54, 0.4) !important;
        color: #e57373 !important;
    }

    /* Responsive status bar */
    @media (max-width: 768px) {
        .professional-status-bar {
            padding: 8px 16px !important;
            font-size: 13px !important;
            min-height: 50px !important;
            gap: 8px !important;
        }
        
        .status-indicator {
            font-size: 12px !important;
            padding: 4px 8px !important;
            gap: 6px !important;
        }
    }

    /* Professional LiveKit Call Notifications */
    .mx_LiveKitCallNotification {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(0, 0, 0, 0.95) !important;
        color: white !important;
        padding: 16px 20px !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        max-width: 350px !important;
        backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        z-index: 20000 !important;
        animation: slideInFromRight 0.3s ease-out !important;
    }

    .mx_LiveKitCallNotification .notification-header {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 12px !important;
    }

    .mx_LiveKitCallNotification .notification-icon {
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #4285f4 0%, #34a853 100%) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 12px !important;
    }

    .mx_LiveKitCallNotification .notification-title {
        font-weight: 600 !important;
        font-size: 16px !important;
    }

    .mx_LiveKitCallNotification .notification-message {
        color: rgba(255, 255, 255, 0.8) !important;
        margin-bottom: 16px !important;
        line-height: 1.4 !important;
    }

    .mx_LiveKitCallNotification .notification-buttons {
        display: flex !important;
        gap: 12px !important;
        justify-content: flex-end !important;
    }

    .mx_LiveKitCallNotification .notification-button {
        padding: 8px 16px !important;
        border-radius: 8px !important;
        border: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
    }

    .mx_LiveKitCallNotification .notification-button.accept {
        background: linear-gradient(135deg, #34a853 0%, #4285f4 100%) !important;
        color: white !important;
    }

    .mx_LiveKitCallNotification .notification-button.accept:hover {
        background: linear-gradient(135deg, #2d8f47 0%, #3367d6 100%) !important;
        transform: translateY(-1px) !important;
    }

    .mx_LiveKitCallNotification .notification-button.decline {
        background: rgba(244, 67, 54, 0.8) !important;
        color: white !important;
    }

    .mx_LiveKitCallNotification .notification-button.decline:hover {
        background: rgba(244, 67, 54, 1) !important;
        transform: translateY(-1px) !important;
    }

    .mx_LiveKitCallNotification .notification-button.dismiss {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
    }

    .mx_LiveKitCallNotification .notification-button.dismiss:hover {
        background: rgba(255, 255, 255, 0.2) !important;
    }

    @keyframes slideInFromRight {
        from {
            transform: translateX(100%) !important;
            opacity: 0 !important;
        }
        to {
            transform: translateX(0) !important;
            opacity: 1 !important;
        }
    }

    /* WhatsApp-style Audio Call Interface */
    .whatsapp-audio-call {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100vh !important;
        width: 100vw !important;
        background: linear-gradient(135deg, rgba(15, 15, 15, 0.85) 0%, rgba(26, 26, 26, 0.85) 100%), url('/img/Call-wallpaper.jpg') center/cover no-repeat !important;
        color: white !important;
        padding: 40px 20px !important;
        box-sizing: border-box !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 10000 !important;
    }

    /* Hide all LiveKit default UI components when in audio call mode */
    .whatsapp-audio-call ~ *,
    .whatsapp-audio-call + * {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Ensure the audio call interface is above everything */
    .lk-room-container .whatsapp-audio-call {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 99999 !important;
    }

    /* Hide LiveKit default components when audio call is active */
    .lk-room-container:has(.whatsapp-audio-call) .lk-control-bar,
    .lk-room-container:has(.whatsapp-audio-call) .lk-video-grid,
    .lk-room-container:has(.whatsapp-audio-call) .lk-grid-layout,
    .lk-room-container:has(.whatsapp-audio-call) .lk-focus-layout,
    .lk-room-container:has(.whatsapp-audio-call) .lk-participant-tile {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Additional rules to ensure clean audio interface */
    .lk-room-container .whatsapp-audio-call {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 1000 !important;
    }

    /* Hide any potential overlay elements from LiveKit */
    .lk-room-container:has(.whatsapp-audio-call) .lk-track-muted-indicator,
    .lk-room-container:has(.whatsapp-audio-call) .lk-participant-metadata,
    .lk-room-container:has(.whatsapp-audio-call) .lk-participant-name,
    .lk-room-container:has(.whatsapp-audio-call) .lk-button-menu,
    .lk-room-container:has(.whatsapp-audio-call) .lk-device-selector,
    .lk-room-container:has(.whatsapp-audio-call) [class*="lk-"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Ensure the audio interface shows over everything */
    .whatsapp-audio-call {
        position: relative !important;
        z-index: 999999 !important;
    }

    /* Fallback: Force hide all LiveKit components when audio call is present */
    body:has(.whatsapp-audio-call) .lk-control-bar,
    body:has(.whatsapp-audio-call) .lk-video-grid,
    body:has(.whatsapp-audio-call) .lk-grid-layout,
    body:has(.whatsapp-audio-call) .lk-focus-layout,
    body:has(.whatsapp-audio-call) .lk-participant-tile:not(.whatsapp-audio-call *) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    /* Ensure parent containers don't interfere */
    .whatsapp-audio-call-container {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 10000 !important;
        background: linear-gradient(135deg, rgba(15, 15, 15, 0.85) 0%, rgba(26, 26, 26, 0.85) 100%), url('/img/Call-wallpaper.jpg') center/cover no-repeat !important;
    }

    .audio-call-content {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 1 !important;
        max-width: 400px !important;
        width: 100% !important;
    }

    .audio-call-avatar {
        width: 200px !important;
        height: 200px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 80px !important;
        color: white !important;
        margin-bottom: 32px !important;
        border: 4px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
        position: relative !important;
        overflow: hidden !important;
    }

    .audio-call-avatar::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%) !important;
        border-radius: 50% !important;
    }

    .audio-call-avatar.talking {
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(74, 175, 79, 0.3), 0 0 0 16px rgba(74, 175, 79, 0.2) !important;
        animation: pulse-talking 2s ease-in-out infinite !important;
    }

    @keyframes pulse-talking {
        0%, 100% {
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(74, 175, 79, 0.3), 0 0 0 16px rgba(74, 175, 79, 0.2) !important;
        }
        50% {
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 12px rgba(74, 175, 79, 0.4), 0 0 0 24px rgba(74, 175, 79, 0.3) !important;
        }
    }

    /* Additional keyframe for guaranteed avatar visibility */
    @keyframes avatarGlow {
        0%, 100% {
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        50% {
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.1);
        }
    }

    .audio-call-name {
        font-size: 32px !important;
        font-weight: 400 !important;
        color: white !important;
        margin-bottom: 12px !important;
        text-align: center !important;
        letter-spacing: -0.5px !important;
    }

    .audio-call-status {
        font-size: 16px !important;
        color: rgba(255, 255, 255, 0.7) !important;
        margin-bottom: 8px !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
    }

    .audio-call-timer {
        font-size: 18px !important;
        color: rgba(255, 255, 255, 0.9) !important;
        font-weight: 300 !important;
        margin-bottom: 60px !important;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace !important;
    }

    .audio-call-controls {
        display: flex !important;
        gap: 24px !important;
        align-items: center !important;
        margin-bottom: 40px !important;
    }

    .audio-control-button {
        width: 64px !important;
        height: 64px !important;
        border-radius: 50% !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 24px !important;
        position: relative !important;
        overflow: hidden !important;
    }

    /* Smaller buttons for group calls */
    .audio-control-button.group-call {
        width: 48px !important;
        height: 48px !important;
        font-size: 18px !important;
    }

    .audio-control-button::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 50% !important;
        transform: scale(0) !important;
        transition: transform 0.3s ease !important;
    }

    .audio-control-button:hover::before {
        transform: scale(1) !important;
    }

    .audio-control-button.mute {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
    }

    .audio-control-button.mute.muted {
        background: rgba(220, 53, 69, 0.8) !important;
        color: white !important;
    }

    .audio-control-button.speaker {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
    }

    .audio-control-button.speaker.active {
        background: rgba(74, 175, 79, 0.8) !important;
        color: white !important;
    }

    .audio-control-button.end-call {
        background: rgba(206, 202, 203, 0.9) !important;
        color: white !important;
        width: 72px !important;
        height: 72px !important;
        font-size: 28px !important;
    }

    .audio-control-button.end-call.group-call {
        width: 56px !important;
        height: 56px !important;
        font-size: 22px !important;
    }

    .audio-control-button.end-call:hover {
        background: rgba(220, 53, 69, 1) !important;
        transform: scale(1.05) !important;
    }

    /* Disabled state for audio control buttons when permissions aren't ready */
    .audio-control-button.permissions-pending {
        background: rgba(100, 100, 100, 0.5) !important;
        color: rgba(255, 255, 255, 0.5) !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
        opacity: 0.6 !important;
        transform: none !important;
    }

    .audio-control-button.end-call.permissions-pending {
        background: rgba(100, 100, 100, 0.5) !important;
    }

    .audio-control-button.permissions-pending:hover {
        background: rgba(100, 100, 100, 0.5) !important;
        transform: none !important;
    }

    .audio-control-button.end-call.permissions-pending:hover {
        background: rgba(100, 100, 100, 0.5) !important;
        transform: none !important;
    }

    /* Connection status indicator for audio calls */
    .audio-connection-status {
        position: absolute !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgba(0, 0, 0, 0.7) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        font-size: 14px !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
    }

    .connection-dot {
        width: 8px !important;
        height: 8px !important;
        border-radius: 50% !important;
        background: #4caf50 !important;
        animation: pulse 2s ease-in-out infinite !important;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1 !important;
        }
        50% {
            opacity: 0.5 !important;
        }
    }

    /* E2EE indicator for audio calls */
    .audio-e2ee-status {
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(74, 175, 79, 0.2) !important;
        border: 1px solid rgba(74, 175, 79, 0.4) !important;
        color: #81c784 !important;
        padding: 8px 12px !important;
        border-radius: 16px !important;
        font-size: 12px !important;
        backdrop-filter: blur(10px) !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
    }

    .audio-e2ee-status.disabled {
        background: rgba(244, 67, 54, 0.2) !important;
        border-color: rgba(244, 67, 54, 0.4) !important;
        color: #e57373 !important;
    }
`;

// Inject styles if not already present
if (!document.getElementById("livekit-call-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "livekit-call-styles";
    styleSheet.textContent = livekitCallStyles;
    document.head.appendChild(styleSheet);
}

// Simple incoming call sound management
// Usage:
// - Call startIncomingCallSound() when showing incoming call notification
// - Call stopIncomingCallSound() when user accepts, declines, or notification times out
let currentIncomingCallAudio: HTMLAudioElement | null = null;

const startIncomingCallSound = (): void => {
    console.log("🔔 Starting incoming call sound");

    try {
        // Stop any existing call sound first
        stopIncomingCallSound();

        // Create new audio element for incoming call
        currentIncomingCallAudio = new Audio();
        currentIncomingCallAudio.src = "/sounds/ring.mp3"; // Adjust path as needed
        currentIncomingCallAudio.loop = true;
        currentIncomingCallAudio.volume = 0.7;

        // Add ID for easy identification
        currentIncomingCallAudio.id = "incoming-call-sound";

        // Play the sound
        currentIncomingCallAudio.play().catch((error) => {
            console.warn("Failed to play incoming call sound:", error);
        });

        console.log("🔔 Incoming call sound started");
    } catch (error) {
        console.warn("Error starting incoming call sound:", error);
    }
};

const stopIncomingCallSound = (): void => {
    try {
        // Stop our tracked audio
        if (currentIncomingCallAudio) {
            currentIncomingCallAudio.pause();
            currentIncomingCallAudio.currentTime = 0;
            currentIncomingCallAudio.src = "";
            currentIncomingCallAudio = null;
        }

        // Also stop any audio with incoming call IDs (fallback)
        const callSounds = document.querySelectorAll("#incoming-call-sound, #call-ring-sound, #ring-sound");
        callSounds.forEach((audio: any) => {
            if (audio && audio.pause) {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0;
                audio.muted = true;
            }
        });

        console.log("🔇 Incoming call sound stopped");
    } catch (error) {
        console.warn("Error stopping incoming call sound:", error);
    }
};

// Make functions available globally
(window as any).startIncomingCallSound = startIncomingCallSound;
(window as any).stopIncomingCallSound = stopIncomingCallSound;

interface VideoRoomProps {
    // Old format (backward compatibility)
    roomName?: string;
    participantName?: string;
    // New format
    roomId?: string;
    toUserIds?: string[];
    toUsernames?: { [userId: string]: string };
    isVideo?: boolean;
    fromUsername?: string;
    groupName?: string;
    testMode?: {
        useWrongKey?: boolean;
        customKey?: string;
    };
    // Call state flags
    isAcceptingIncomingCall?: boolean; // True when user accepts an incoming call
    isJoiningOngoingCall?: boolean; // True when user is joining an existing ongoing call
    // Callback to close the modal when leave is clicked
    onLeave?: () => void;
}

// Enhanced professional participant tile component
const ProfessionalParticipantTile: React.FC<{ trackRef: TrackReference }> = ({ trackRef }) => {
    const participant = trackRef.participant;
    const isLocal = participant.isLocal;
    const rawDisplayName = participant.name || participant.identity || "Unknown User";
    const displayName = normalizeDisplayName(rawDisplayName);
    const isMuted = participant.isMicrophoneEnabled === false;
    const isSpeaking = participant.isSpeaking;
    const connectionQuality = participant.connectionQuality;

    // Connection quality indicators removed for cleaner UI

    return (
        <div
            className={`lk-participant-tile ${isLocal ? "local-participant" : "remote-participant"} ${isSpeaking ? "speaking" : ""}`}
            data-participant-name={displayName}
            data-connection-quality={connectionQuality}
            data-local={isLocal ? "true" : "false"}
            data-lk-local-participant={isLocal ? "true" : "false"}
        >
            {/* Video content area */}
            <div className="lk-participant-video-container">
                <ParticipantTile trackRef={trackRef} />

                {/* Top overlay indicators */}
                <div className="lk-participant-overlays">{/* Connection quality indicator - REMOVED */}</div>
            </div>

            {/* Info bar with name and status indicators */}
            <div className="lk-participant-info-bar">
                <div className="lk-participant-name" title={displayName}>
                    {isLocal ? `${displayName} (You)` : displayName}
                </div>

                <div className="lk-participant-indicators">
                    {isMuted && (
                        <div className="lk-participant-metadata muted" title="Microphone muted">
                            🎙️
                        </div>
                    )}
                    {participant.isCameraEnabled === false && (
                        <div className="lk-participant-metadata camera-off" title="Camera off">
                            📹
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Function to normalize display names (remove @ prefix and domain suffix)
const normalizeDisplayName = (name: string): string => {
    if (!name) return "Unknown User";

    let normalized = name;

    // Remove @ prefix if present
    if (normalized.startsWith("@")) {
        normalized = normalized.substring(1);
    }

    // Remove domain part after : if present (e.g., ":ms2.beep.gov.pk")
    const colonIndex = normalized.indexOf(":");
    if (colonIndex !== -1) {
        normalized = normalized.substring(0, colonIndex);
    }

    return normalized || "Unknown User";
};

// WhatsApp-style Audio Call Component
const AudioCallInterface: React.FC<{
    isVideo: boolean;
    permissionsReady: boolean;
    onVideoToggle?: (enableVideo: boolean) => Promise<void>;
    isTransitioning?: boolean;
    globalCallTimer?: number;
    isCallEstablished?: boolean;
}> = ({
    isVideo,
    permissionsReady,
    onVideoToggle,
    isTransitioning = false,
    globalCallTimer = 0,
    isCallEstablished = false,
}) => {
    const room = useRoomContext();
    const participants = useParticipants();
    const [isMuted, setIsMuted] = useState(false);
    const callEstablished = useRef(false);
    const autoLeaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callStartTimeLocal = useRef<number | null>(null);
    const isAutoEndingRef = useRef<boolean>(false);

    // Get all tracks for audio handling
    const audioTracks = useTracks(["microphone"], {
        onlySubscribed: false,
    });

    // Get participants
    const remoteParticipants = participants.filter((p) => !p.isLocal);
    const localParticipant = participants.find((p) => p.isLocal);
    const participantCount = participants.length;

    // Determine if this is a group call (more than 2 participants total)
    const isGroupCall = participantCount > 2;

    // For 1-to-1 calls, get the single remote participant
    const singleRemoteParticipant = remoteParticipants[0];

    // Auto-leave logic for audio calls
    useEffect(() => {
        // Clear any existing timeout
        if (autoLeaveTimeout.current) {
            clearTimeout(autoLeaveTimeout.current);
            autoLeaveTimeout.current = null;
        }

        if (!room) return;

        // Track call start time when we have exactly 1 participant (the caller)
        if (participantCount === 1 && !callStartTimeLocal.current) {
            callStartTimeLocal.current = Date.now();
            console.log("🎯 Audio call started - 30s no-answer timeout activated");
        }

        // Mark call as established if we have 2 or more participants
        if (participantCount >= 2) {
            if (!callEstablished.current) {
                callEstablished.current = true;
                callStartTimeLocal.current = null; // Clear no-answer timeout
                console.log("🎯 Audio call established - multiple participants detected");

                // Emit call established event to clear outgoing call state globally
                const callEstablishedEvent = new CustomEvent("liveKitCallEstablished", {
                    detail: {
                        participantCount,
                        callType: "audio",
                        timestamp: new Date().toISOString(),
                    },
                });
                window.dispatchEvent(callEstablishedEvent);
                console.log("📤 Emitted liveKitCallEstablished event (audio)");
            }
        }

        // Scenario 1: No-answer timeout (30 seconds with only 1 participant)
        if (participantCount === 1 && !callEstablished.current && callStartTimeLocal.current) {
            const timeElapsed = Date.now() - callStartTimeLocal.current;
            const remainingTime = 30000 - timeElapsed; // 30 seconds total

            if (remainingTime > 0) {
                console.log(`🎯 Audio call no-answer timeout: ${Math.ceil(remainingTime / 1000)}s remaining`);
                // Capture roomData for timeout scenario, with fallback to incoming call data
                const currentRoomData = (window as any).__currentLiveKitRoomData;
                const incomingCallData = (window as any).__incomingCallData;
                const roomDataForTimeout = currentRoomData || incomingCallData;
                autoLeaveTimeout.current = setTimeout(() => {
                    if (room && room.state === "connected" && participantCount === 1 && !callEstablished.current) {
                        console.log("🎯 Auto-leaving audio call - no one answered within 30 seconds");

                        // Emit call ended event for no-answer timeout using captured roomData
                        if (roomDataForTimeout?.roomId && roomDataForTimeout?.toUserIds) {
                            console.log("📞 No-answer timeout - emitting CALL_ENDED event with captured data");
                            emitCallEndedEvent(roomDataForTimeout.roomId, roomDataForTimeout.toUserIds).catch((err) =>
                                console.error("Failed to emit call ended event on timeout:", err),
                            );
                        }

                        isAutoEndingRef.current = true; // Mark as auto-ending due to timeout
                        isAutoEndingCall = true; // Set global flag
                        room.disconnect().catch((err: any) => {
                            console.warn("Error during no-answer auto-leave:", err);
                        });
                    }
                }, remainingTime);
            } else {
                // Time already exceeded, leave immediately
                console.log("🎯 Auto-leaving audio call - 30s no-answer timeout exceeded");

                // Emit call ended event for immediate timeout, with fallback to incoming call data
                const currentRoomData = (window as any).__currentLiveKitRoomData;
                const incomingCallData = (window as any).__incomingCallData;
                const roomData = currentRoomData || incomingCallData;
                if (roomData?.roomId && roomData?.toUserIds) {
                    console.log("📞 Immediate timeout - emitting CALL_ENDED event");
                    emitCallEndedEvent(roomData.roomId, roomData.toUserIds).catch((err) =>
                        console.error("Failed to emit call ended event on immediate timeout:", err),
                    );
                }

                isAutoEndingRef.current = true; // Mark as auto-ending due to timeout
                isAutoEndingCall = true; // Set global flag
                room.disconnect().catch((err: any) => {
                    console.warn("Error during immediate no-answer auto-leave:", err);
                });
            }
        }

        // Scenario 2: Everyone left after call was established (immediate for 1-to-1, 3s grace for group)
        else if (callEstablished.current && participantCount === 1) {
            const graceTime = isGroupCall ? 3000 : 1000; // 1s for 1-to-1, 3s for group
            console.log(
                `🎯 Only one participant left after audio call was established - scheduling auto-leave in ${graceTime}ms`,
            );

            // Capture roomData now while it's still available, before component might unmount
            // Prioritize incoming call data for complete participant context, fallback to current room data
            const currentRoomData = (window as any).__currentLiveKitRoomData;
            const incomingCallData = (window as any).__incomingCallData;

            const roomData = incomingCallData || currentRoomData;
            console.log("📊 roomData captured for auto leave", {
                currentRoomData,
                incomingCallData,
                finalRoomData: roomData,
                source: roomData === incomingCallData ? "incomingCallData" : "currentRoomData",
                incomingToUserIds: incomingCallData?.toUserIds,
                currentToUserIds: currentRoomData?.toUserIds,
            });
            console.log("isGroupCall", isGroupCall);

            autoLeaveTimeout.current = setTimeout(() => {
                if (room && room.state === "connected" && participantCount === 1) {
                    console.log("🎯 Auto-leaving audio call - only one participant remaining");

                    // Build participant IDs from actual participants for more reliable context
                    // This ensures we have complete participant info even when roomData is incomplete
                    let participantIds: string[] = [];

                    // Prioritize incoming call data as it contains the most complete participant list
                    const currentRoomData = (window as any).__currentLiveKitRoomData;
                    console.log("currentRoomData", currentRoomData);
                    const incomingCallData = (window as any).__incomingCallData;
                    console.log("incomingCallData", incomingCallData);
                    if (incomingCallData?.toUserIds && incomingCallData.toUserIds.length > 1) {
                        // Use incoming call data as it has the most complete participant list
                        participantIds = incomingCallData.toUserIds;
                        console.log(
                            "📞 Using incoming call data toUserIds for complete participant context:",
                            participantIds,
                        );
                    } else if (currentRoomData?.toUserIds && currentRoomData.toUserIds.length > 0) {
                        // Fallback to current room data
                        participantIds = currentRoomData.toUserIds;
                        console.log("📞 Using current room data toUserIds for participant context:", participantIds);
                    } else {
                        // Fallback: build from current and recent participants
                        // Include all participants who were in the call (current + recently left)
                        const currentParticipantIds = participants
                            .map((p) => p.identity)
                            .filter((identity) => identity && identity.trim() !== "");

                        // Get recently left participants from global call data if available
                        const globalCallData = (window as any).__globalActiveCallData;
                        const recentParticipants = globalCallData?.participants || [];
                        const recentParticipantIds = recentParticipants
                            .map((p: any) => p.userId || p.id)
                            .filter(Boolean);

                        // Also get comprehensive participant tracking
                        const allCallParticipants = (window as any).__allCallParticipants || new Set<string>();
                        const trackedParticipantIds = Array.from(allCallParticipants);

                        // Combine and deduplicate
                        participantIds = [
                            ...new Set([...currentParticipantIds, ...recentParticipantIds, ...trackedParticipantIds]),
                        ];
                        console.log("📞 Built participant IDs from current and recent participants:", {
                            currentParticipantIds,
                            recentParticipantIds,
                            trackedParticipantIds,
                            finalParticipantIds: participantIds,
                        });
                    }

                    // Emit call ended event before disconnecting for group calls
                    const finalRoomId = roomData?.roomId || currentRoomData?.roomId || incomingCallData?.roomId;
                    if (finalRoomId && participantIds.length > 0) {
                        console.log("📞 Auto-leave audio call - emitting CALL_ENDED event with participant context", {
                            roomId: finalRoomId,
                            participantIds,
                            dataSource: roomData === incomingCallData ? "incomingCallData" : "currentRoomData",
                        });
                        emitCallEndedEvent(finalRoomId, participantIds).catch((err) =>
                            console.error("Failed to emit call ended event on auto-leave:", err),
                        );
                    } else {
                        console.warn("📞 Auto-leave audio call - cannot emit CALL_ENDED event", {
                            hasRoomData: !!roomData,
                            hasRoomId: !!finalRoomId,
                            participantIdsLength: participantIds.length,
                            isGroupCall,
                            currentRoomDataRoomId: currentRoomData?.roomId,
                            incomingCallDataRoomId: incomingCallData?.roomId,
                        });
                    }

                    isAutoEndingRef.current = true; // Mark as auto-ending due to everyone leaving
                    isAutoEndingCall = true; // Set global flag
                    room.disconnect().catch((err: any) => {
                        console.warn("Error during everyone-left auto-leave:", err);
                    });
                }
            }, graceTime);
        }
    }, [participantCount, room, isGroupCall, participants]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (autoLeaveTimeout.current) {
                clearTimeout(autoLeaveTimeout.current);
            }
        };
    }, []);

    // Use global call timer instead of local timer

    // Format timer display
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Get status text
    const getStatusText = (): string => {
        if (participants.length < 2) {
            return "Calling...";
        }
        if (isMuted) {
            return "Muted";
        }
        return "Connected";
    };

    // Handle mute toggle
    const handleMuteToggle = async (): Promise<void> => {
        if (room && localParticipant) {
            try {
                const newMutedState = !isMuted;
                await room.localParticipant.setMicrophoneEnabled(!newMutedState);
                setIsMuted(newMutedState);
                console.log(`🎙️ Microphone ${newMutedState ? "muted" : "unmuted"}`);
            } catch (error) {
                console.error("Failed to toggle microphone:", error);
            }
        }
    };

    // Handle end call
    const handleEndCall = (): void => {
        // Don't allow ending call if permissions aren't ready yet
        if (!permissionsReady) {
            console.log("🔒 Cannot end call - permissions still pending");
            return;
        }

        console.log("📞 Ending audio call");

        // Get room data for event emission, with fallback to incoming call data
        const currentRoomData = (window as any).__currentLiveKitRoomData;
        const incomingCallData = (window as any).__incomingCallData;
        const globalActiveCallData = (window as any).__globalActiveCallData;

        console.log("📞 AudioCallInterface DEBUG: Checking all room data sources:");
        console.log("📞 AudioCallInterface currentRoomData:", currentRoomData);
        console.log("📞 AudioCallInterface incomingCallData:", incomingCallData);
        console.log("📞 AudioCallInterface globalActiveCallData:", globalActiveCallData);

        // Priority: currentRoomData > incomingCallData > globalActiveCallData (for home screen accepted calls)
        let roomData = currentRoomData || incomingCallData;

        // Special handling for calls accepted from home screen - use globalActiveCallData
        if (!roomData && globalActiveCallData) {
            console.log("📞 AudioCallInterface: Using globalActiveCallData for home screen accepted call");
            // Convert globalActiveCallData format to expected roomData format
            roomData = {
                roomId: globalActiveCallData.roomId,
                toUserIds: [], // We don't have this info in globalActiveCallData, but it's not critical for USER_LEFT_CALL
                toUsernames: {},
                fromUsername: undefined,
                groupName: undefined,
                isVideo: globalActiveCallData.callType === "video",
            };
        }

        // Additional fallback: If room data is missing, log it for debugging
        if (!roomData || !roomData.roomId) {
            console.log("📞 AudioCallInterface: Room data missing - events may not be emitted");
        }

        if (roomData?.roomId) {
            if (participantCount === 1) {
                // Last participant leaving - emit CALL_ENDED
                if (roomData?.toUserIds) {
                    console.log("📞 User ending call as only participant - emitting CALL_ENDED event");
                    emitCallEndedEvent(roomData.roomId, roomData.toUserIds).catch((err) =>
                        console.error("Failed to emit call ended event:", err),
                    );
                }
            } else {
                // Not the last participant - emit USER_LEFT_CALL to clean up backend state
                console.log("📞 User ending call but not last participant - emitting USER_LEFT_CALL event");
                console.log("📞 USER_LEFT_CALL event data:", {
                    roomId: roomData.roomId,
                    participantCount: participantCount,
                });
                emitUserLeftCallEvent(roomData.roomId).catch((err) =>
                    console.error("Failed to emit user left call event:", err),
                );
            }
        }

        if (room) {
            room.disconnect().catch((err: any) => {
                console.warn("Error ending call:", err);
            });
        }
    };

    // Get first letter for avatar fallback - guaranteed to return visible content
    const getAvatarFallback = (name: string): string => {
        if (!name || name.trim().length === 0) {
            return "?";
        }
        const firstChar = name.trim().charAt(0).toUpperCase();
        return firstChar || "U"; // Fallback to "U" for User if somehow empty
    };

    const isE2EEEnabled = room?.isE2EEEnabled;

    // Calculate optimal layout for any number of participants
    const calculateLayout = (count: number): { columns: number; avatarSize: number } => {
        if (count <= 2) return { columns: 1, avatarSize: 200 }; // Single avatar for 1-to-1
        // if (count <= 4) return { columns: 2, avatarSize: 100 };
        if (count <= 6) return { columns: 3, avatarSize: 85 };
        if (count <= 9) return { columns: 3, avatarSize: 75 };
        if (count <= 12) return { columns: 4, avatarSize: 65 };
        return { columns: 4, avatarSize: 60 };
    };

    const { columns, avatarSize } = calculateLayout(participantCount);

    // For group calls (3+ participants)
    if (isGroupCall) {
        return (
            <div
                className="whatsapp-audio-call"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    background:
                        "linear-gradient(135deg, rgba(15, 15, 15, 0.85) 0%, rgba(26, 26, 26, 0.85) 100%), url('/img/Call-wallpaper.jpg') center/cover no-repeat",
                    color: "white",
                    overflow: "hidden",
                    zIndex: 10000,
                }}
            >
                {/* E2EE Status - Fixed absolute positioning */}
                <div
                    className={`audio-e2ee-status ${isE2EEEnabled ? "" : "disabled"}`}
                    style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        zIndex: 20,
                    }}
                >
                    <span>{isE2EEEnabled ? "🔒" : "🔓"}</span>
                    <span>{isE2EEEnabled ? "End-to-end encrypted" : "Not Encrypted"}</span>
                </div>

                {/* Main Container with proper flex layout */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100vh",
                        padding: "0",
                        margin: "0",
                    }}
                >
                    {/* Header Section - Fixed height */}
                    <div
                        style={{
                            flexShrink: 0,
                            textAlign: "center",
                            padding: "40px 20px 20px 20px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "28px",
                                fontWeight: "400",
                                marginBottom: "8px",
                            }}
                        >
                            Group Call
                        </div>
                        <div
                            style={{
                                fontSize: "16px",
                                opacity: 0.8,
                            }}
                        >
                            {participantCount} participants
                        </div>
                    </div>

                    {/* Avatar Grid - Full space, independent scrolling */}
                    <div
                        style={{
                            flex: 1,
                            overflow: "auto",
                            padding: "40px 30px",
                            display: "grid",
                            gridTemplateColumns: `repeat(${columns}, 1fr)`,
                            gap: "40px",
                            justifyItems: "center",
                            alignContent: "start",
                            minHeight: 0,
                            width: "100%",
                        }}
                    >
                        {participants.map((participant) => {
                            const displayName = normalizeDisplayName(
                                participant.name || participant.identity || "Unknown User",
                            );
                            const isLocalUser = participant.isLocal;
                            const isSpeaking = participant.isSpeaking;
                            const avatarText = getAvatarFallback(displayName);

                            console.log("🎭 Rendering group participant:", {
                                sid: participant.sid,
                                displayName,
                                isLocalUser,
                                isSpeaking,
                                avatarText,
                                avatarSize,
                            });

                            return (
                                <div
                                    key={participant.sid}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: "16px",
                                        width: "100%",
                                        maxWidth: "200px",
                                        padding: "20px",
                                        minHeight: `${avatarSize + 80}px`,
                                    }}
                                >
                                    {/* Avatar with same design as 1-to-1 call */}
                                    <div
                                        style={{
                                            width: `${avatarSize}px`,
                                            height: `${avatarSize}px`,
                                            borderRadius: "50%",
                                            background: "linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: `${Math.max(24, avatarSize * 0.4)}px`,
                                            color: "white",
                                            fontWeight: "600",
                                            border: isSpeaking
                                                ? "4px solid rgba(74, 175, 79, 0.8)"
                                                : "4px solid rgba(255, 255, 255, 0.1)",
                                            boxShadow: isSpeaking
                                                ? "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(74, 175, 79, 0.3), 0 0 0 16px rgba(74, 175, 79, 0.2)"
                                                : "0 20px 60px rgba(0, 0, 0, 0.3)",
                                            position: "relative",
                                            overflow: "hidden",
                                            transition: "all 0.3s ease",
                                            flexShrink: 0,
                                            zIndex: 10,
                                            // Force visibility
                                            opacity: 1,
                                            visibility: "visible",
                                            animation: isSpeaking ? "pulse-talking 2s ease-in-out infinite" : "none",
                                        }}
                                    >
                                        {/* Shine effect */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background:
                                                    "linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)",
                                                borderRadius: "50%",
                                                pointerEvents: "none",
                                            }}
                                        />
                                        {avatarText}
                                    </div>

                                    {/* Username */}
                                    <div
                                        style={{
                                            fontSize: "16px",
                                            color: "white",
                                            textAlign: "center",
                                            maxWidth: "160px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            fontWeight: "500",
                                            lineHeight: "1.2",
                                        }}
                                    >
                                        {isLocalUser ? "You" : displayName}
                                        {participant.isMicrophoneEnabled === false && " 🔇"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Status and Timer - Above controls */}
                    <div
                        style={{
                            flexShrink: 0,
                            textAlign: "center",
                            padding: "20px",
                            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                    >
                        <div style={{ marginBottom: "8px", fontSize: "16px", opacity: 0.9 }}>
                            {isMuted && <span>🔇 </span>}
                            <span>{getStatusText()}</span>
                        </div>
                        {globalCallTimer > 0 && (
                            <div
                                style={{
                                    fontSize: "18px",
                                    fontFamily:
                                        "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
                                    opacity: 0.9,
                                }}
                            >
                                {formatTime(globalCallTimer)}
                            </div>
                        )}
                    </div>

                    {/* Controls Container - Fixed at bottom */}
                    <div
                        style={{
                            flexShrink: 0,
                            padding: "20px 20px 30px 20px",
                            backdropFilter: "blur(10px)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                gap: "32px",
                                alignItems: "center",
                                justifyContent: "center",
                                maxWidth: "400px",
                                margin: "0 auto",
                            }}
                        >
                            <button
                                className={`audio-control-button group-call mute ${isMuted ? "muted" : ""}`}
                                onClick={handleMuteToggle}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9l4.19 4.18L21 20.73 4.27 3z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15a.998.998 0 0 0-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21h2v-3.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                )}
                            </button>

                            {onVideoToggle && (
                                <button
                                    className={`audio-control-button group-call video-toggle ${isTransitioning ? "transitioning" : ""}`}
                                    onClick={() => onVideoToggle(true)}
                                    title={isTransitioning ? "Switching to video..." : "Turn on camera"}
                                    disabled={isTransitioning}
                                >
                                    {isTransitioning ? (
                                        "⏳"
                                    ) : (
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                    )}
                                </button>
                            )}

                            <button
                                className={`audio-control-button group-call end-call ${!permissionsReady ? "permissions-pending" : ""}`}
                                onClick={handleEndCall}
                                title={!permissionsReady ? "Please wait..." : "End Call"}
                                disabled={!permissionsReady}
                            >
                                📞
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hidden audio tracks */}
                {audioTracks.map((trackRef) => {
                    if (
                        !trackRef.participant.isLocal &&
                        trackRef.source === "microphone" &&
                        trackRef.publication?.track &&
                        trackRef.publication?.isSubscribed
                    ) {
                        return (
                            <audio
                                key={`audio-${trackRef.participant.sid}`}
                                ref={(element) => {
                                    if (element && trackRef.publication?.track) {
                                        const track = trackRef.publication.track;
                                        const mediaStream = new MediaStream([track.mediaStreamTrack]);
                                        element.srcObject = mediaStream;
                                        element.autoplay = true;
                                        element.volume = 1.0;
                                        element.play().catch((error) => {
                                            console.warn("Failed to play remote audio:", error);
                                        });
                                    }
                                }}
                                style={{ display: "none" }}
                            />
                        );
                    }
                    return null;
                })}
            </div>
        );
    }

    // 1-to-1 Call Interface (2 participants or less)
    const displayName = singleRemoteParticipant
        ? normalizeDisplayName(singleRemoteParticipant.name || singleRemoteParticipant.identity || "Unknown User")
        : normalizeDisplayName(localParticipant?.name || localParticipant?.identity || "Unknown User");

    const isRemoteParticipantSpeaking = singleRemoteParticipant?.isSpeaking || false;

    return (
        <div
            className="whatsapp-audio-call"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
                position: "fixed",
                top: 0,
                left: 0,
                padding: "20px",
                boxSizing: "border-box",
            }}
        >
            {/* E2EE Status */}
            <div
                className={`audio-e2ee-status ${isE2EEEnabled ? "" : "disabled"}`}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    zIndex: 10,
                }}
            >
                <span>{isE2EEEnabled ? "🔒" : "🔓"}</span>
                <span>{isE2EEEnabled ? "End-to-end encrypted" : "Not Encrypted"}</span>
            </div>

            {/* Main Content - Centered */}
            <div
                className="audio-call-content"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    maxWidth: "400px",
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                {/* Avatar with explicit inline styles to guarantee visibility */}
                <div
                    style={{
                        width: "200px",
                        height: "200px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "80px",
                        color: "white",
                        fontWeight: "600",
                        marginBottom: "32px",
                        border: isRemoteParticipantSpeaking
                            ? "4px solid rgba(74, 175, 79, 0.8)"
                            : "4px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: isRemoteParticipantSpeaking
                            ? "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(74, 175, 79, 0.3), 0 0 0 16px rgba(74, 175, 79, 0.2)"
                            : "0 20px 60px rgba(0, 0, 0, 0.3)",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.3s ease",
                        animation: isRemoteParticipantSpeaking ? "pulse-talking 2s ease-in-out infinite" : "none",
                    }}
                >
                    {/* Shine effect */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background:
                                "linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%)",
                            borderRadius: "50%",
                            pointerEvents: "none",
                        }}
                    />
                    {getAvatarFallback(displayName)}
                </div>

                {/* Name */}
                <div className="audio-call-name">{displayName}</div>

                {/* Status */}
                <div className="audio-call-status">
                    {isMuted && <span>🔇</span>}
                    <span>{getStatusText()}</span>
                </div>

                {/* Timer */}
                {globalCallTimer > 0 && <div className="audio-call-timer">{formatTime(globalCallTimer)}</div>}

                {/* Controls */}
                <div className="audio-call-controls">
                    <button
                        className={`audio-control-button mute ${isMuted ? "muted" : ""}`}
                        onClick={handleMuteToggle}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9l4.19 4.18L21 20.73 4.27 3z"
                                    fill="currentColor"
                                />
                            </svg>
                        ) : (
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16c-2.47 0-4.52-1.8-4.93-4.15a.998.998 0 0 0-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21h2v-3.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"
                                    fill="currentColor"
                                />
                            </svg>
                        )}
                    </button>

                    {onVideoToggle && (
                        <button
                            className={`audio-control-button video-toggle ${isTransitioning ? "transitioning" : ""}`}
                            onClick={() => onVideoToggle(true)}
                            title={isTransitioning ? "Switching to video..." : "Turn on camera"}
                            disabled={isTransitioning}
                        >
                            {isTransitioning ? (
                                "⏳"
                            ) : (
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"
                                        fill="currentColor"
                                    />
                                </svg>
                            )}
                        </button>
                    )}

                    <button
                        className={`audio-control-button end-call ${!permissionsReady ? "permissions-pending" : ""}`}
                        onClick={handleEndCall}
                        title={!permissionsReady ? "Please wait..." : "End Call"}
                        disabled={!permissionsReady}
                    >
                        📞
                    </button>
                </div>
            </div>

            {/* Hidden audio tracks */}
            {audioTracks.map((trackRef) => {
                if (
                    !trackRef.participant.isLocal &&
                    trackRef.source === "microphone" &&
                    trackRef.publication?.track &&
                    trackRef.publication?.isSubscribed
                ) {
                    return (
                        <audio
                            key={`audio-${trackRef.participant.sid}`}
                            ref={(element) => {
                                if (element && trackRef.publication?.track) {
                                    const track = trackRef.publication.track;
                                    const mediaStream = new MediaStream([track.mediaStreamTrack]);
                                    element.srcObject = mediaStream;
                                    element.autoplay = true;
                                    element.volume = 1.0;
                                    element.play().catch((error) => {
                                        console.warn("Failed to play remote audio:", error);
                                    });
                                }
                            }}
                            style={{ display: "none" }}
                        />
                    );
                }
                return null;
            })}
        </div>
    );
};

const RoomContent = ({ isVideo }: { isVideo: boolean }): JSX.Element => {
    const room = useRoomContext();
    const e2eeInitialized = useRef(false);
    const [decryptionErrors, setDecryptionErrors] = useState<string[]>([]);
    const [permissionErrors, setPermissionErrors] = useState<{
        camera?: string;
        microphone?: string;
        general?: string;
    }>({});
    // Track permission readiness to enable/disable leave button
    const [permissionsReady, setPermissionsReady] = useState(false);

    // Track if call was ever established with multiple participants
    const callEstablished = useRef(false);
    const autoLeaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callStartTime = useRef<number | null>(null);
    const isAutoEndingRef = useRef<boolean>(false);

    // Get all participants for count
    const participants = useParticipants();
    const currentCount = participants.length;

    // Dynamic video mode state - allows switching from audio to video during call
    const [isDynamicVideoMode, setIsDynamicVideoMode] = useState(isVideo);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Shared call timer state - persists across UI mode switches
    const [callTimer, setCallTimer] = useState(0);
    const callStartTimeGlobal = useRef<number | null>(null);
    const callEstablishedGlobal = useRef(false);

    // Detect if any participant has video enabled
    const hasAnyVideoParticipant = participants.some((participant) => participant.isCameraEnabled === true);

    // Determine if we should use video interface (any participant has video OR user toggled to video)
    const shouldUseVideoInterface = isDynamicVideoMode || hasAnyVideoParticipant;

    // Auto-reset dynamic video mode when local participant turns off camera via LiveKit controls
    useEffect(() => {
        const localParticipant = participants.find((p) => p.isLocal);
        if (localParticipant && localParticipant.isCameraEnabled === false && isDynamicVideoMode) {
            console.log("🔄 Local camera disabled via LiveKit - resetting dynamic video mode");
            setIsDynamicVideoMode(false);
        }
    }, [participants, isDynamicVideoMode]);

    // Debug logging for video state changes
    useEffect(() => {
        const videoParticipants = participants.filter((p) => p.isCameraEnabled === true);
        console.log(
            "🎥 Video participants:",
            videoParticipants.map((p) => ({
                name: p.name || p.identity,
                isLocal: p.isLocal,
                isCameraEnabled: p.isCameraEnabled,
            })),
        );
        console.log(
            `🎬 UI Mode: ${shouldUseVideoInterface ? "VIDEO" : "AUDIO"} (isDynamic: ${isDynamicVideoMode}, hasAnyVideo: ${hasAnyVideoParticipant})`,
        );
    }, [participants, isDynamicVideoMode, hasAnyVideoParticipant, shouldUseVideoInterface]);

    // Global call timer that persists across UI mode switches
    useEffect(() => {
        if (!room) return;

        // Start timer when call is established (2+ participants)
        if (currentCount >= 2 && !callEstablishedGlobal.current) {
            callEstablishedGlobal.current = true;
            callStartTimeGlobal.current = Date.now();
            console.log("🕐 Global call timer started");
        }

        // Update timer every second
        const timer = setInterval(() => {
            if (callEstablishedGlobal.current && callStartTimeGlobal.current) {
                const elapsed = Math.floor((Date.now() - callStartTimeGlobal.current) / 1000);
                setCallTimer(elapsed);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [currentCount, room]);

    // Handle dynamic video mode toggle
    const handleVideoModeToggle = async (enableVideo: boolean): Promise<void> => {
        if (!room || isTransitioning) return;

        setIsTransitioning(true);
        try {
            if (enableVideo) {
                // Enable camera for video mode
                await room.localParticipant.setCameraEnabled(true);
                console.log("📹 Camera enabled - switching to video mode");
            } else {
                // Disable camera for audio mode
                await room.localParticipant.setCameraEnabled(false);
                console.log("📹 Camera disabled - switching to audio mode");
            }
            setIsDynamicVideoMode(enableVideo);
        } catch (error) {
            console.error("Failed to toggle video mode:", error);
        } finally {
            setIsTransitioning(false);
        }
    };

    // Track dynamic video mode changes for better UX
    useEffect(() => {
        if (isDynamicVideoMode !== isVideo) {
            console.log(`🔄 Video mode changed: ${isVideo} → ${isDynamicVideoMode}`);
        }
    }, [isDynamicVideoMode, isVideo]);

    // Notify parent component about participant count changes
    useEffect(() => {
        // Dispatch custom event with participant count
        window.dispatchEvent(
            new CustomEvent("liveKitParticipantCountUpdate", {
                detail: { count: currentCount },
            }),
        );
    }, [currentCount]);

    // Make participant count available to parent VideoRoom component
    useEffect(() => {
        (window as any).__currentParticipantCount = currentCount;
    }, [currentCount]);

    // Get all tracks (video and audio) for proper audio/video handling
    // For video calls, explicitly exclude screen_share to prevent mobile screen issues
    const allTracks = useTracks(shouldUseVideoInterface ? ["camera", "microphone"] : ["microphone"], {
        onlySubscribed: false,
    });

    // Get audio tracks separately for proper audio handling
    const audioTracks = useTracks(["microphone"], {
        onlySubscribed: false,
    });

    // Get all screen share tracks to explicitly filter them out for uniform experience
    const screenShareTracks = useTracks(["screen_share"], {
        onlySubscribed: false,
    });

    // Enhanced deduplication logic with strict camera-only filtering for video calls
    const uniqueTracks = allTracks.reduce(
        (acc, trackRef) => {
            const participantSid = trackRef.participant.sid;
            const trackSource = trackRef.source;

            // Log track details for debugging mobile issues
            console.log("🎥 Processing track:", {
                participantSid,
                source: trackSource,
                kind: trackRef.publication?.kind,
                isLocal: trackRef.participant.isLocal,
                participantName: trackRef.participant.name || trackRef.participant.identity,
            });

            // Skip screen share tracks completely to maintain uniform experience
            if (trackSource === "screen_share" || trackSource === "screen_share_audio") {
                console.log("⚠️ Skipping screen share track for uniform experience");
                return acc;
            }

            // For video calls, prioritize camera tracks strictly
            if (shouldUseVideoInterface) {
                // If we don't have this participant yet
                if (!acc.find((t) => t.participant.sid === participantSid)) {
                    // Only add camera tracks for video calls - this prevents mobile screen issues
                    if (trackSource === "camera") {
                        console.log("✅ Adding camera track for video call");
                        acc.push(trackRef);
                    } else if (trackSource === "microphone") {
                        // Only add microphone if no camera track exists for this participant
                        const hasCameraTrack = allTracks.some(
                            (t) => t.participant.sid === participantSid && t.source === "camera",
                        );
                        if (!hasCameraTrack) {
                            console.log("✅ Adding microphone track (no camera available)");
                            acc.push(trackRef);
                        }
                    }
                } else {
                    // If we already have this participant, always prefer camera over microphone
                    const existingIndex = acc.findIndex((t) => t.participant.sid === participantSid);
                    const existing = acc[existingIndex];
                    if (existing.source === "microphone" && trackSource === "camera") {
                        console.log("🔄 Replacing microphone with camera track");
                        acc[existingIndex] = trackRef;
                    }
                }
            } else {
                // For audio calls, only process microphone tracks
                if (trackSource === "microphone" && !acc.find((t) => t.participant.sid === participantSid)) {
                    console.log("🎙️ Adding microphone track for audio call");
                    acc.push(trackRef);
                }
            }

            return acc;
        },
        [] as typeof allTracks,
    );

    // Warn if screen share tracks are detected
    if (screenShareTracks.length > 0) {
        console.warn(
            "📺 Screen share tracks detected - these are filtered out for uniform experience:",
            screenShareTracks.map((t) => ({
                participant: t.participant.name || t.participant.identity,
                source: t.source,
            })),
        );
    }

    // Debug logging for participant count issues
    const uniqueTrackCount = uniqueTracks.length;

    console.log("Grid debugging:", {
        totalParticipants: participants.length,
        allTracksCount: allTracks.length,
        audioTracksCount: audioTracks.length,
        uniqueTracksCount: uniqueTrackCount,
        uniqueTrackDetails: uniqueTracks.map((t) => ({
            sid: t.participant.sid,
            source: t.source,
            isLocal: t.participant.isLocal,
            name: t.participant.name || t.participant.identity,
        })),
        audioTrackDetails: audioTracks.map((t) => ({
            sid: t.participant.sid,
            source: t.source,
            isLocal: t.participant.isLocal,
            isSubscribed: !!t.publication?.isSubscribed,
            isMuted: t.publication?.isMuted,
            name: t.participant.name || t.participant.identity,
        })),
        decryptionErrorCount: decryptionErrors.length,
    });

    // Force re-render when participant count changes to ensure grid updates
    useEffect(() => {
        console.log(`🎯 Participant count changed to: ${currentCount}`);
        console.log(`🎯 Grid should show data-participant-count="${currentCount}"`);

        // Add a small delay to ensure the DOM has updated
        setTimeout(() => {
            const gridElement = document.querySelector(".lk-video-grid");
            if (gridElement) {
                console.log(
                    `🎯 Grid element found with data-participant-count="${gridElement.getAttribute("data-participant-count")}"`,
                );
                console.log(`🎯 Grid computed styles:`, {
                    display: getComputedStyle(gridElement).display,
                    gridTemplateColumns: getComputedStyle(gridElement).gridTemplateColumns,
                    gridTemplateRows: getComputedStyle(gridElement).gridTemplateRows,
                });
            } else {
                console.warn("🎯 Grid element not found!");
            }
        }, 100);
    }, [currentCount, uniqueTracks.length]);

    // Auto-leave logic: Only when using video interface (including audio-to-video conversions)
    useEffect(() => {
        // Skip auto-leave for pure audio calls since AudioCallInterface handles it
        // But allow auto-leave for audio-to-video conversions when video interface is active
        if (!shouldUseVideoInterface) return;

        // Clear any existing timeout
        if (autoLeaveTimeout.current) {
            clearTimeout(autoLeaveTimeout.current);
            autoLeaveTimeout.current = null;
        }

        if (!room) return;

        // Track call start time when we have exactly 1 participant (the caller)
        if (currentCount === 1 && !callStartTime.current) {
            callStartTime.current = Date.now();
            console.log("🎯 Video call started - 30s no-answer timeout activated");
        }

        // Mark call as established if we have 2 or more participants
        if (currentCount >= 2) {
            if (!callEstablished.current) {
                callEstablished.current = true;
                callStartTime.current = null; // Clear no-answer timeout
                console.log("🎯 Video call established - multiple participants detected");

                // Emit call established event to clear outgoing call state globally
                const callEstablishedEvent = new CustomEvent("liveKitCallEstablished", {
                    detail: {
                        participantCount: currentCount,
                        callType: "video",
                        timestamp: new Date().toISOString(),
                    },
                });
                window.dispatchEvent(callEstablishedEvent);
                console.log("📤 Emitted liveKitCallEstablished event (video)");
            }
        }

        // Scenario 1: No-answer timeout (30 seconds with only 1 participant)
        if (currentCount === 1 && !callEstablished.current && callStartTime.current) {
            const timeElapsed = Date.now() - callStartTime.current;
            const remainingTime = 30000 - timeElapsed; // 30 seconds total

            if (remainingTime > 0) {
                console.log(`🎯 Video call no-answer timeout: ${Math.ceil(remainingTime / 1000)}s remaining`);
                // Capture roomData for video timeout scenario, with fallback to incoming call data
                const currentRoomData = (window as any).__currentLiveKitRoomData;
                const incomingCallData = (window as any).__incomingCallData;
                const roomDataForVideoTimeout = currentRoomData || incomingCallData;
                autoLeaveTimeout.current = setTimeout(() => {
                    if (room && room.state === "connected" && currentCount === 1 && !callEstablished.current) {
                        console.log("🎯 Auto-leaving video call - no one answered within 30 seconds");

                        // Emit call ended event for video call no-answer timeout using captured roomData
                        console.log("roomDataForVideoTimeout", roomDataForVideoTimeout);
                        if (roomDataForVideoTimeout?.roomId && roomDataForVideoTimeout?.toUserIds) {
                            console.log(
                                "📞 Video call no-answer timeout - emitting CALL_ENDED event with captured data",
                            );
                            emitCallEndedEvent(roomDataForVideoTimeout.roomId, roomDataForVideoTimeout.toUserIds).catch(
                                (err) => console.error("Failed to emit call ended event on video timeout:", err),
                            );
                        }

                        isAutoEndingRef.current = true; // Mark as auto-ending due to timeout
                        isAutoEndingCall = true; // Set global flag
                        room.disconnect().catch((err: any) => {
                            console.warn("Error during no-answer auto-leave:", err);
                        });
                    }
                }, remainingTime);
            } else {
                // Time already exceeded, leave immediately
                console.log("🎯 Auto-leaving video call - 30s no-answer timeout exceeded");

                // Emit call ended event for video call immediate timeout, with fallback to incoming call data
                const currentRoomData = (window as any).__currentLiveKitRoomData;
                const incomingCallData = (window as any).__incomingCallData;
                const roomData = currentRoomData || incomingCallData;
                console.log("roomData for video immediate timeout", {
                    currentRoomData,
                    incomingCallData,
                    finalRoomData: roomData,
                });
                if (roomData?.roomId && roomData?.toUserIds) {
                    console.log("📞 Video call immediate timeout - emitting CALL_ENDED event");
                    emitCallEndedEvent(roomData.roomId, roomData.toUserIds).catch((err) =>
                        console.error("Failed to emit call ended event on video immediate timeout:", err),
                    );
                }

                isAutoEndingRef.current = true; // Mark as auto-ending due to timeout
                isAutoEndingCall = true; // Set global flag
                room.disconnect().catch((err: any) => {
                    console.warn("Error during immediate no-answer auto-leave:", err);
                });
            }
        }

        // Scenario 2: Everyone left after call was established (3 second grace period)
        else if (callEstablished.current && currentCount === 1) {
            console.log("🎯 Only one participant left after video call was established - scheduling auto-leave");

            // Capture roomData now while it's still available, before component might unmount
            // Prioritize incoming call data for complete participant context, fallback to current room data
            const currentRoomData = (window as any).__currentLiveKitRoomData;
            const incomingCallData = (window as any).__incomingCallData;

            const roomData = incomingCallData || currentRoomData;
            // For video calls, determine if it's a group call based on toUserIds length
            const isGroupVideoCall = roomData?.toUserIds && roomData.toUserIds.length > 1;
            console.log("roomData captured for video auto leave", {
                currentRoomData,
                incomingCallData,
                finalRoomData: roomData,
                source: currentRoomData ? "currentLiveKitRoomData" : incomingCallData ? "incomingCallData" : "none",
            });
            console.log("isGroupVideoCall", isGroupVideoCall);

            autoLeaveTimeout.current = setTimeout(() => {
                if (room && room.state === "connected" && currentCount === 1) {
                    console.log("🎯 Auto-leaving video call - only one participant remaining");

                    // Build participant IDs from actual participants for more reliable context
                    // This ensures we have complete participant info even when roomData is incomplete
                    let participantIds: string[] = [];

                    // Prioritize incoming call data as it contains the most complete participant list
                    const currentRoomData = (window as any).__currentLiveKitRoomData;
                    const incomingCallData = (window as any).__incomingCallData;

                    if (incomingCallData?.toUserIds && incomingCallData.toUserIds.length > 1) {
                        // Use incoming call data as it has the most complete participant list
                        participantIds = incomingCallData.toUserIds;
                        console.log(
                            "📞 Using incoming call data toUserIds for complete video participant context:",
                            participantIds,
                        );
                    } else if (currentRoomData?.toUserIds && currentRoomData.toUserIds.length > 0) {
                        // Fallback to current room data
                        participantIds = currentRoomData.toUserIds;
                        console.log(
                            "📞 Using current room data toUserIds for video participant context:",
                            participantIds,
                        );
                    } else {
                        // Fallback: build from current and recent participants
                        // Include all participants who were in the call (current + recently left)
                        const roomParticipants = room
                            ? Array.from(room.remoteParticipants.values()).concat(room.localParticipant)
                            : [];
                        const currentParticipantIds = roomParticipants
                            .map((p: any) => p.identity)
                            .filter((identity) => identity && identity.trim() !== "");

                        // Get recently left participants from global call data if available
                        const globalCallData = (window as any).__globalActiveCallData;
                        const recentParticipants = globalCallData?.participants || [];
                        const recentParticipantIds = recentParticipants
                            .map((p: any) => p.userId || p.id)
                            .filter(Boolean);

                        // Also get comprehensive participant tracking
                        const allCallParticipants = (window as any).__allCallParticipants || new Set<string>();
                        const trackedParticipantIds = Array.from(allCallParticipants);

                        // Combine and deduplicate
                        participantIds = [
                            ...new Set([...currentParticipantIds, ...recentParticipantIds, ...trackedParticipantIds]),
                        ];
                        console.log("📞 Built video participant IDs from current and recent participants:", {
                            currentParticipantIds,
                            recentParticipantIds,
                            finalParticipantIds: participantIds,
                        });
                    }

                    // Emit call ended event before disconnecting for group calls
                    const finalRoomId = roomData?.roomId || currentRoomData?.roomId || incomingCallData?.roomId;
                    if (finalRoomId && participantIds.length > 0) {
                        console.log("📞 Auto-leave video call - emitting CALL_ENDED event with participant context", {
                            roomId: finalRoomId,
                            participantIds,
                            dataSource: roomData === incomingCallData ? "incomingCallData" : "currentRoomData",
                        });
                        emitCallEndedEvent(finalRoomId, participantIds).catch((err) =>
                            console.error("Failed to emit call ended event on video auto-leave:", err),
                        );
                    } else {
                        console.warn("📞 Auto-leave video call - cannot emit CALL_ENDED event", {
                            hasRoomData: !!roomData,
                            hasRoomId: !!finalRoomId,
                            participantIdsLength: participantIds.length,
                            isGroupVideoCall,
                            currentRoomDataRoomId: currentRoomData?.roomId,
                            incomingCallDataRoomId: incomingCallData?.roomId,
                        });
                    }

                    isAutoEndingRef.current = true; // Mark as auto-ending due to everyone leaving
                    isAutoEndingCall = true; // Set global flag
                    room.disconnect().catch((err: any) => {
                        console.warn("Error during everyone-left auto-leave:", err);
                    });
                }
            }, 3000); // 3 second grace period
        }
    }, [currentCount, room, shouldUseVideoInterface]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (autoLeaveTimeout.current) {
                clearTimeout(autoLeaveTimeout.current);
            }
        };
    }, []);

    useEffect(() => {
        if (room && !e2eeInitialized.current) {
            e2eeInitialized.current = true;

            // Enable E2EE after room is ready
            room.setE2EEEnabled(true)
                .then(() => {
                    console.log("E2EE enabled successfully");

                    // Delay verification to ensure room is fully connected
                    setTimeout(() => {
                        console.log("E2EE Verification (after connection):", {
                            isE2EEEnabled: room.isE2EEEnabled,
                            localParticipant: room.localParticipant?.identity || "Not set yet",
                            e2eeManager: room.isE2EEEnabled ? "✅ Active" : "❌ Inactive",
                            connectionState: room.state,
                        });
                    }, 2000); // Wait 2 seconds for full connection
                })
                .catch((err: Error) => {
                    console.error("Failed to enable E2EE:", err);
                });

            // Listen for encryption/decryption errors
            room.on("trackSubscribed", (track: any, publication: any, participant: any) => {
                console.log(`Track ${track.sid} encryption status:`, {
                    isEncrypted: publication.isEncrypted,
                    participant: participant.identity,
                    source: publication.source,
                    e2eeEnabled: room.isE2EEEnabled,
                    trackKind: track.kind,
                    encryptionType: publication.isEncrypted ? "🔒 End-to-End Encrypted" : "⚠️ Unencrypted",
                });

                // Filter out screen share tracks to maintain uniform viewing experience
                if (publication.source === "screen_share" || publication.source === "screen_share_audio") {
                    console.log("📺 Screen share track detected - filtering out for uniform experience");
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                        navigator.userAgent,
                    );
                    if (isMobile) {
                        console.warn("📱 Mobile device detected with screen share - this may cause display issues");
                    }
                    // Note: Track will still be subscribed but filtered out in the grid rendering
                }

                // Monitor for decryption failures
                track.on("muted", () => {
                    if (publication.isEncrypted) {
                        const errorMsg = `🚨 Possible decryption failure: ${participant.identity}'s ${track.kind} track muted (wrong key?)`;
                        console.warn(errorMsg);
                        setDecryptionErrors((prev) => [...prev, errorMsg]);
                    }
                });

                track.on("unmuted", () => {
                    if (publication.isEncrypted) {
                        const successMsg = `✅ Decryption working: ${participant.identity}'s ${track.kind} track active`;
                        console.log(successMsg);
                        // Remove error for this track if it exists
                        setDecryptionErrors((prev) =>
                            prev.filter((error) => !error.includes(`${participant.identity}'s ${track.kind}`)),
                        );
                    }
                });
            });

            // Listen for local tracks being published
            room.on("localTrackPublished", (publication: any) => {
                console.log("Local track published with E2EE:", {
                    trackSid: publication.trackSid,
                    kind: publication.kind,
                    source: publication.source,
                    isEncrypted: publication.isEncrypted,
                    e2eeEnabled: room.isE2EEEnabled,
                });

                // Detect and prevent accidental screen sharing on mobile
                if (publication.source === "screen_share" || publication.source === "screen_share_audio") {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                        navigator.userAgent,
                    );
                    console.warn("📱 Screen share detected on", isMobile ? "mobile device" : "desktop");

                    if (isMobile) {
                        console.warn(
                            "🚫 Mobile screen sharing may cause viewing issues - consider switching to camera",
                        );
                        // Optionally unpublish screen share on mobile to maintain uniform experience
                        // room.localParticipant.unpublishTrack(publication.track);
                    }
                }
            });

            // Listen for room state changes
            room.on("connected", () => {
                console.log("Room fully connected - Final E2EE status:", {
                    isE2EEEnabled: room.isE2EEEnabled,
                    localParticipant: room.localParticipant.identity,
                    roomState: room.state,
                });

                // Request media permissions based on call type
                const mediaConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: isVideo
                        ? {
                              // Mobile-optimized video constraints
                              width: { ideal: 640, max: 1280 },
                              height: { ideal: 480, max: 720 },
                              frameRate: { ideal: 15, max: 30 },
                              facingMode: "user", // Explicitly request front camera on mobile
                              aspectRatio: { ideal: 4 / 3 }, // Consistent aspect ratio
                          }
                        : false, // Only request video for video calls
                };

                console.log(
                    `🎙️ Requesting media permissions for ${isVideo ? "VIDEO" : "AUDIO"} call:`,
                    mediaConstraints,
                );

                navigator.mediaDevices
                    .getUserMedia(mediaConstraints)
                    .then(() => {
                        console.log(`✅ Media permissions granted for ${isVideo ? "VIDEO" : "AUDIO"} call`);
                        // Clear any previous permission errors since permissions are now granted
                        setPermissionErrors({});

                        if (isVideo) {
                            // For video calls, enable both camera and microphone
                            return room.localParticipant.enableCameraAndMicrophone();
                        } else {
                            // For voice calls, only enable microphone
                            console.log("🎙️ Voice call - enabling microphone only");
                            return room.localParticipant.setMicrophoneEnabled(true);
                        }
                    })
                    .then(() => {
                        if (isVideo) {
                            console.log("✅ Camera and microphone enabled for video call");
                            // Explicitly ensure microphone is enabled for video calls
                            return room.localParticipant.setMicrophoneEnabled(true);
                        } else {
                            console.log("✅ Microphone enabled for voice call");
                            // Explicitly disable camera for voice calls
                            return room.localParticipant.setCameraEnabled(false);
                        }
                    })
                    .then(() => {
                        console.log(`✅ ${isVideo ? "Video" : "Voice"} call setup completed successfully`);
                        // Mark permissions as ready - leave button can now be enabled
                        setPermissionsReady(true);
                        console.log("🔒 Permissions ready - leave button enabled");
                    })
                    .catch((err: any) => {
                        console.warn(`Failed to setup ${isVideo ? "video" : "voice"} call:`, err);

                        // Check if this is a permission error
                        if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
                            console.warn("❌ Permission denied for media access");
                            setPermissionErrors({
                                general: `${isVideo ? "Camera and microphone" : "Microphone"} access denied. Please allow permissions to join the call.`,
                            });
                        } else {
                            console.warn("❌ Other media setup error:", err);
                            setPermissionErrors({
                                general: `Failed to setup ${isVideo ? "video" : "voice"} call: ${err.message || err.name || "Unknown error"}`,
                            });
                        }

                        // Fallback: try enabling them separately
                        if (isVideo) {
                            room.localParticipant
                                .setCameraEnabled(true)
                                .then(() => {
                                    console.log("✅ Camera enabled (fallback)");
                                    // Clear camera error if successful
                                    setPermissionErrors((prev) => {
                                        const { camera, ...rest } = prev;
                                        return rest;
                                    });
                                })
                                .catch((e: any) => {
                                    console.warn("❌ Camera enable failed (fallback):", e);
                                    if (e.name === "NotAllowedError" || e.message?.includes("Permission denied")) {
                                        setPermissionErrors((prev) => ({
                                            ...prev,
                                            camera: "Camera access denied. Please allow camera permissions in your browser settings.",
                                        }));
                                    }
                                });
                        }

                        room.localParticipant
                            .setMicrophoneEnabled(true)
                            .then(() => {
                                console.log("✅ Microphone enabled (fallback)");
                                // Clear microphone error if successful
                                setPermissionErrors((prev) => {
                                    const { microphone, ...rest } = prev;
                                    return rest;
                                });
                            })
                            .catch((e: any) => {
                                console.warn("❌ Microphone enable failed (fallback):", e);
                                if (e.name === "NotAllowedError" || e.message?.includes("Permission denied")) {
                                    setPermissionErrors((prev) => ({
                                        ...prev,
                                        microphone:
                                            "Microphone access denied. Please allow microphone permissions in your browser settings.",
                                    }));
                                }
                            })
                            .finally(() => {
                                // Mark permissions as ready even if there were errors - user should be able to leave
                                setPermissionsReady(true);
                                console.log("🔒 Permissions resolved (with potential errors) - leave button enabled");
                            });
                    });
            });
        }
    }, [room, isVideo]);

    // Add/remove disabled class on disconnect button based on permission state
    useEffect(() => {
        const updateDisconnectButtonState = (): void => {
            // Find all potential disconnect/leave buttons
            const disconnectButtons = document.querySelectorAll(`
                .lk-control-bar .lk-disconnect-button,
                .lk-control-bar .lk-button[data-lk-source="disconnect"],
                .lk-control-bar button[aria-label*="disconnect"],
                .lk-control-bar button[aria-label*="leave"],
                .lk-control-bar button[title*="disconnect"],
                .lk-control-bar button[title*="leave"],
                .lk-control-bar .lk-button:last-child
            `);

            disconnectButtons.forEach((button) => {
                if (!permissionsReady) {
                    button.classList.add("permissions-pending");
                    console.log("🔒 Disabled disconnect button - permissions pending");
                } else {
                    button.classList.remove("permissions-pending");
                    console.log("✅ Enabled disconnect button - permissions ready");
                }
            });
        };

        // Update immediately
        updateDisconnectButtonState();

        // Also update with a small delay to catch dynamically created buttons
        const timeoutId = setTimeout(updateDisconnectButtonState, 100);
        const timeoutId2 = setTimeout(updateDisconnectButtonState, 500);
        const timeoutId3 = setTimeout(updateDisconnectButtonState, 1000);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(timeoutId2);
            clearTimeout(timeoutId3);
        };
    }, [permissionsReady]);

    const isE2EEEnabled = room?.isE2EEEnabled;

    // For audio calls, use the WhatsApp-style interface with video toggle capability
    // Show audio interface only when NO participants have video enabled
    if (!shouldUseVideoInterface) {
        return (
            <div
                className={`whatsapp-audio-call-container ${isTransitioning ? "transitioning" : ""}`}
                style={{
                    transition: "all 0.3s ease-in-out",
                    opacity: isTransitioning ? 0.7 : 1,
                }}
            >
                <AudioCallInterface
                    isVideo={isDynamicVideoMode}
                    permissionsReady={permissionsReady}
                    onVideoToggle={handleVideoModeToggle}
                    isTransitioning={isTransitioning}
                    globalCallTimer={callTimer}
                    isCallEstablished={callEstablishedGlobal.current}
                />
            </div>
        );
    }

    // For video calls, use the existing grid interface
    return (
        <div
            className={`professional-video-room ${isTransitioning ? "transitioning" : ""}`}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.3s ease-in-out",
                opacity: isTransitioning ? 0.7 : 1,
            }}
        >
            {/* Professional Status Bar */}
            <div className="professional-status-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div className={`status-indicator ${isE2EEEnabled ? "e2ee-enabled" : "e2ee-disabled"}`}>
                        <span>{isE2EEEnabled ? "🔒" : "🔓"}</span>
                        <span>E2EE: {isE2EEEnabled ? "Enabled" : "Disabled"}</span>
                    </div>

                    <div className="status-indicator">
                        <span>👥</span>
                        <span>
                            {currentCount} Participant{currentCount !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Debug info in development */}
                    {process.env.NODE_ENV === "development" && (
                        <div className="status-indicator" style={{ fontSize: "12px", opacity: 0.7 }}>
                            <span>🔧</span>
                            <span>
                                Grid: {currentCount} | Tracks: {allTracks.length}
                            </span>
                        </div>
                    )}
                </div>

                {/* Show connection quality or other indicators */}
                <div className="status-indicator">
                    <span>🟢</span>
                    <span>Connected</span>
                </div>
            </div>

            {/* Professional Video Grid */}
            <div className="lk-video-grid" data-participant-count={currentCount}>
                {uniqueTracks.map((trackRef) => (
                    <ProfessionalParticipantTile
                        key={`${trackRef.participant.sid}-${trackRef.source}`}
                        trackRef={trackRef}
                    />
                ))}

                {/* Show placeholder when no participants */}
                {currentCount === 0 && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255, 255, 255, 0.6)",
                            fontSize: "18px",
                            gridColumn: "1 / -1",
                            gridRow: "1 / -1",
                        }}
                    >
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📞</div>
                        <div>Waiting for participants to join...</div>
                        <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.7 }}>
                            The call will start once someone joins
                        </div>
                    </div>
                )}
            </div>

            {/* Professional Control Bar with proper z-index */}
            <div
                style={{
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 1000,
                }}
                className="lk-control-bar-container"
            >
                <ControlBar className="lk-control-bar" />
            </div>

            {/* Hidden audio tracks for remote participants - ensures audio playback */}
            {audioTracks.map((trackRef) => {
                // Only render audio tracks for remote participants that are subscribed
                if (
                    !trackRef.participant.isLocal &&
                    trackRef.source === "microphone" &&
                    trackRef.publication?.track &&
                    trackRef.publication?.isSubscribed
                ) {
                    console.log(
                        `🔊 Rendering audio element for remote participant: ${trackRef.participant.identity || trackRef.participant.name}`,
                    );

                    return (
                        <audio
                            key={`audio-${trackRef.participant.sid}`}
                            ref={(element) => {
                                if (element && trackRef.publication?.track) {
                                    const track = trackRef.publication.track;
                                    const mediaStream = new MediaStream([track.mediaStreamTrack]);
                                    element.srcObject = mediaStream;
                                    element.autoplay = true;
                                    element.volume = 1.0; // Ensure full volume

                                    console.log(`🔊 Setting up audio for ${trackRef.participant.identity}:`, {
                                        trackKind: track.kind,
                                        trackId: track.sid,
                                        mediaStreamId: mediaStream.id,
                                        hasAudioTracks: mediaStream.getAudioTracks().length > 0,
                                    });

                                    // Ensure audio plays
                                    element.play().catch((error) => {
                                        console.warn("Failed to play remote audio:", error);
                                    });
                                }
                            }}
                            style={{ display: "none" }}
                        />
                    );
                }
                return null;
            })}

            {/* Decryption Errors Display */}
            {/* {decryptionErrors.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: "80px",
                        right: "20px",
                        background: "rgba(244, 67, 54, 0.9)",
                        color: "white",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        fontSize: "14px",
                        maxWidth: "300px",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(244, 67, 54, 1)",
                        zIndex: 1000,
                    }}
                >
                    <div style={{ fontWeight: "bold", marginBottom: "8px" }}>🚨 Decryption Issues Detected</div>
                    {decryptionErrors.slice(0, 3).map((error, index) => (
                        <div key={index} style={{ fontSize: "12px", marginBottom: "4px", opacity: 0.9 }}>
                            {error}
                        </div>
                    ))}
                    {decryptionErrors.length > 3 && (
                        <div style={{ fontSize: "12px", opacity: 0.7 }}>
                            +{decryptionErrors.length - 3} more issues...
                        </div>
                    )}
                </div>
            )} */}

            {/* Permission Errors Display */}
            {Object.keys(permissionErrors).length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: "80px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(244, 67, 54, 0.95)",
                        color: "white",
                        padding: "16px 20px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        maxWidth: "500px",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(244, 67, 54, 1)",
                        zIndex: 1000,
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            fontWeight: "bold",
                            marginBottom: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "18px" }}>🚫</span>
                        <span>Permission Required</span>
                    </div>

                    {permissionErrors.general && (
                        <div style={{ marginBottom: "8px", lineHeight: "1.4" }}>{permissionErrors.general}</div>
                    )}

                    {permissionErrors.camera && (
                        <div style={{ marginBottom: "8px", lineHeight: "1.4" }}>📹 {permissionErrors.camera}</div>
                    )}

                    {permissionErrors.microphone && (
                        <div style={{ marginBottom: "8px", lineHeight: "1.4" }}>🎙️ {permissionErrors.microphone}</div>
                    )}

                    <div
                        style={{
                            marginTop: "12px",
                            padding: "8px",
                            background: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            lineHeight: "1.3",
                        }}
                    >
                        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>How to fix:</div>
                        <div>1. Click the 🔒 or 📹/🎙️ icon in your browser's address bar</div>
                        <div>2. Allow camera and microphone access</div>
                        <div>3. Refresh the page and try again</div>
                    </div>

                    <button
                        onClick={() => setPermissionErrors({})}
                        style={{
                            marginTop: "12px",
                            background: "rgba(255, 255, 255, 0.2)",
                            border: "1px solid rgba(255, 255, 255, 0.3)",
                            color: "white",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

// Utility function to show LiveKit call notifications
const showLiveKitCallNotification = (
    type: "incoming" | "outgoing",
    data: {
        caller: string;
        isVideo: boolean;
        participantCount?: number;
        onAccept?: () => void;
        onDecline?: () => void;
        onDismiss?: () => void;
    },
): string => {
    const notificationId = `livekit-call-${Date.now()}`;

    // Check if there's already an incoming call notification displayed
    const existingIncomingNotifications = document.querySelectorAll(".mx_LiveKitCallNotification");

    if (type === "incoming") {
        const canAccept = canAcceptNewIncomingCall();
        if (!canAccept) {
            console.log("🚫 Ignoring new incoming call - system busy or already has incoming call");
            console.log("📞 Rejected call details:", { caller: data.caller, isVideo: data.isVideo });
            return ""; // Return empty string to indicate notification was not created
        }

        // Mark that we now have an active incoming call
        setIncomingCallState(true, data.caller);
    }

    // For outgoing calls or when no incoming call is active, remove existing notifications
    if (type === "outgoing" || existingIncomingNotifications.length === 0) {
        document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => {
            el.remove();
        });
        console.log("🧹 Removed existing LiveKit call notifications before creating new one");
    }

    const notification = document.createElement("div");
    notification.className = "mx_LiveKitCallNotification";
    notification.id = notificationId;

    const isIncoming = type === "incoming";
    const callType = data.isVideo ? "Video" : "Voice";
    const icon = data.isVideo ? "📹" : "📞";

    // Start incoming call sound for incoming calls
    if (isIncoming && (window as any).startIncomingCallSound) {
        (window as any).startIncomingCallSound();
    }

    const handleAccept = (): void => {
        console.log("📞 Call accepted, removing notification");

        // Stop incoming call sound
        if ((window as any).stopIncomingCallSound) {
            (window as any).stopIncomingCallSound();
        }

        // Mark call as just accepted for fallback detection
        if ((window as any).markCallAsJustAccepted) {
            (window as any).markCallAsJustAccepted();
        }

        // Clear incoming call state since call is being accepted
        setIncomingCallState(false);

        notification.remove();
        // Also remove any other notifications that might exist
        document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => {
            if (el !== notification) el.remove();
        });

        data.onAccept?.();
    };

    const handleDecline = (): void => {
        console.log("📞 Call declined, removing notification");

        // Stop incoming call sound
        if ((window as any).stopIncomingCallSound) {
            (window as any).stopIncomingCallSound();
        }

        // Clear incoming call state since call is being declined
        setIncomingCallState(false);

        notification.remove();
        // Also remove any other notifications that might exist
        document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => {
            if (el !== notification) el.remove();
        });

        data.onDecline?.();
    };

    const handleDismiss = (): void => {
        console.log("📞 Call dismissed, removing notification");

        // Stop incoming call sound
        if ((window as any).stopIncomingCallSound) {
            (window as any).stopIncomingCallSound();
        }

        // Clear incoming call state since call is being dismissed
        setIncomingCallState(false);

        notification.remove();
        // Also remove any other notifications that might exist
        document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => {
            if (el !== notification) el.remove();
        });

        data.onDismiss?.();
    };

    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-icon">${icon}</div>
            <div class="notification-title">
                ${isIncoming ? "Incoming" : "Outgoing"} ${callType} Call
            </div>
        </div>
        <div class="notification-message">
            ${
                isIncoming
                    ? `${data.caller} is calling you`
                    : `Calling ${data.participantCount ? data.participantCount + " participant" + (data.participantCount > 1 ? "s" : "") : data.caller}`
            }
        </div>
        <div class="notification-buttons">
            ${
                isIncoming
                    ? `
                    <button class="notification-button decline" data-action="decline">
                        Decline
                    </button>
                    <button class="notification-button accept" data-action="accept">
                        Accept
                    </button>
                  `
                    : `
                    <button class="notification-button dismiss" data-action="dismiss">
                        Dismiss
                    </button>
                  `
            }
        </div>
    `;

    // Add event listeners to buttons
    notification.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute("data-action");

        if (action === "accept") {
            handleAccept();
        } else if (action === "decline") {
            handleDecline();
        } else if (action === "dismiss") {
            handleDismiss();
        }
    });

    document.body.appendChild(notification);

    // Auto-dismiss after 30 seconds for incoming calls, 5 seconds for outgoing
    const autoDismissTime = isIncoming ? 30000 : 5000;
    const timeoutId = setTimeout(() => {
        if (document.getElementById(notificationId)) {
            console.log("📞 Auto-dismissing call notification after timeout");
            // Clear incoming call state for timeout as well
            if (isIncoming) {
                setIncomingCallState(false);
            }
            handleDismiss();
        }
    }, autoDismissTime);

    // Store timeout ID so it can be cleared if notification is manually dismissed
    (notification as any).timeoutId = timeoutId;

    console.log(`📞 Created ${type} call notification with ID: ${notificationId}`);
    return notificationId;
};

// Export the notification function for use in other components
(window as any).showLiveKitCallNotification = showLiveKitCallNotification;

// Export a function to clear all LiveKit call notifications
const clearAllLiveKitCallNotifications = (): void => {
    console.log("🧹 Clearing ALL LiveKit call notifications");
    document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => {
        // Clear any timeouts associated with the notification
        const timeout = (el as any).timeoutId;
        if (timeout) {
            clearTimeout(timeout);
        }
        el.remove();
    });

    // Clear incoming call state when clearing all notifications
    setIncomingCallState(false);

    console.log("✅ All LiveKit call notifications cleared");
};

// Make the clear function available globally
(window as any).clearAllLiveKitCallNotifications = clearAllLiveKitCallNotifications;

// Clean up complex audio logic - keeping it simple now

// Global state to track recent call acceptances
let recentCallAcceptanceTime: number | null = null;
const markCallAsJustAccepted = (): void => {
    recentCallAcceptanceTime = Date.now();
    console.log("📞 Marked call as just accepted at:", recentCallAcceptanceTime);
};

const wasCallRecentlyAccepted = (): boolean => {
    if (!recentCallAcceptanceTime) return false;
    const timeSinceAcceptance = Date.now() - recentCallAcceptanceTime;
    const isRecent = timeSinceAcceptance < 5000; // 5 seconds window
    if (isRecent) {
        console.log(`📞 Call was recently accepted ${timeSinceAcceptance}ms ago`);
    }
    return isRecent;
};

const clearRecentCallAcceptance = (): void => {
    recentCallAcceptanceTime = null;
    console.log("📞 Cleared recent call acceptance flag");
};

// Make these functions available globally
(window as any).markCallAsJustAccepted = markCallAsJustAccepted;
(window as any).wasCallRecentlyAccepted = wasCallRecentlyAccepted;
(window as any).clearRecentCallAcceptance = clearRecentCallAcceptance;

// Global active call state management
let isCallCurrentlyActive = false;
let isAutoEndingCall = false;
let hasActiveIncomingCall = false;

const setCallActiveState = (active: boolean): void => {
    isCallCurrentlyActive = active;
    console.log(`📞 Call active state changed to: ${active}`);

    // Also update body class for additional checking
    if (active) {
        document.body.classList.add("mx_LiveKitCall_active");
    } else {
        document.body.classList.remove("mx_LiveKitCall_active");
    }
};

const getCallActiveState = (): boolean => {
    return isCallCurrentlyActive;
};

// Incoming call notification state management
const setIncomingCallState = (active: boolean, caller?: string): void => {
    hasActiveIncomingCall = active;
    console.log(`📞 Incoming call state changed to: ${active}${caller ? ` (from: ${caller})` : ""}`);
};

const getIncomingCallState = (): boolean => {
    return hasActiveIncomingCall;
};

// Helper function to check if system can accept new incoming calls
const canAcceptNewIncomingCall = (): boolean => {
    const hasExistingIncomingNotification = document.querySelectorAll(".mx_LiveKitCallNotification").length > 0;
    const isInActiveCall = isCallCurrentlyActive;
    const hasIncomingCallFlag = hasActiveIncomingCall;

    const canAccept = !hasExistingIncomingNotification && !isInActiveCall && !hasIncomingCallFlag;

    console.log("🤔 Can accept new incoming call?", {
        canAccept,
        hasExistingIncomingNotification,
        isInActiveCall,
        hasIncomingCallFlag,
    });

    return canAccept;
};

// Make these functions available globally for socket handler
(window as any).setCallActiveState = setCallActiveState;
(window as any).getCallActiveState = getCallActiveState;
(window as any).setIncomingCallState = setIncomingCallState;
(window as any).getIncomingCallState = getIncomingCallState;
(window as any).canAcceptNewIncomingCall = canAcceptNewIncomingCall;

// Initialize incoming call state to false on page load (safety reset)
setIncomingCallState(false);

export const VideoRoom = ({
    roomName,
    participantName,
    roomId,
    toUserIds,
    toUsernames,
    isVideo = true, // Default to video call for backward compatibility
    fromUsername,
    groupName,
    testMode,
    isAcceptingIncomingCall = false, // Default to false for backward compatibility
    isJoiningOngoingCall = false, // Default to false for backward compatibility
    onLeave,
}: VideoRoomProps): JSX.Element => {
    // State for managing ongoing call detection
    const [ongoingCallInfo, setOngoingCallInfo] = useState<{
        participants: Array<{ userId: string; username: string; isOnline: boolean }>;
        participantCount: number;
    } | null>(null);
    const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
    const [connectionApproved, setConnectionApproved] = useState(false);

    // Store room data globally for access in nested components
    useEffect(() => {
        console.log("📞 VideoRoom props received:", {
            roomId,
            toUserIds,
            toUsernames,
            fromUsername,
            groupName,
            isVideo,
            isAcceptingIncomingCall,
        });

        // If this is an accepted incoming call and we have globalActiveCallData but no proper props,
        // preserve the call data from globalActiveCallData for later event emission
        const globalActiveCallData = (window as any).__globalActiveCallData;
        if (isAcceptingIncomingCall && globalActiveCallData && (!roomId || !toUserIds)) {
            console.log("📞 Preserving globalActiveCallData for incoming call event emission");
            (window as any).__incomingCallData = {
                roomId: globalActiveCallData.roomId,
                fromUsername: fromUsername || "Unknown",
                groupName: groupName,
                isVideo: globalActiveCallData.callType === "video",
                toUserIds: toUserIds || [],
                toUsernames: toUsernames || {},
            };
        }

        const currentRoomData = {
            roomId,
            toUserIds,
            toUsernames,
            fromUsername,
            groupName,
            isVideo,
        };

        (window as any).__currentLiveKitRoomData = currentRoomData;
        console.log("📞 Stored __currentLiveKitRoomData:", currentRoomData);

        // Set up custom event listener for participant count updates
        const handleParticipantCountUpdate = (event: CustomEvent): void => {
            (window as any).__currentParticipantCount = event.detail.count;
        };

        window.addEventListener("liveKitParticipantCountUpdate", handleParticipantCountUpdate as EventListener);

        // Initialize global participant tracking if not already done
        if (!(window as any).__allCallParticipants) {
            (window as any).__allCallParticipants = new Set<string>();
        }

        return () => {
            // Clean up room data and event listener when component unmounts
            delete (window as any).__currentLiveKitRoomData;
            window.removeEventListener("liveKitParticipantCountUpdate", handleParticipantCountUpdate as EventListener);
        };
    }, [roomId, toUserIds, toUsernames, fromUsername, groupName, isVideo, isAcceptingIncomingCall]);

    // Listen for call_ended events from backend
    useEffect(() => {
        const handleCallEnded = (data: any): void => {
            console.log("📞 VideoRoom: Received call_ended event from backend:", data);

            // Stop incoming call sounds
            if ((window as any).stopIncomingCallSound) {
                (window as any).stopIncomingCallSound();
            }

            // Clear all call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
            }

            // Close the call modal if this is the same room
            if (data.roomId === roomId) {
                console.log("📞 VideoRoom: Call ended for current room, closing modal");
                console.log("📞 VideoRoom: onLeave callback available:", !!onLeave);
                console.log("📞 VideoRoom: About to call onLeave()");

                // Call the onLeave callback to close the UI
                if (onLeave) {
                    onLeave();
                    console.log("📞 VideoRoom: onLeave() called successfully");
                } else {
                    console.warn("📞 VideoRoom: onLeave callback not available!");
                }

                // Set global call state to false to ensure UI cleanup
                if ((window as any).setCallActiveState) {
                    console.log("📞 VideoRoom: Setting global call active state to false");
                    (window as any).setCallActiveState(false);
                }

                console.log("📞 VideoRoom: Call decline handling completed");
            } else {
                console.log("📞 VideoRoom: Call ended for different room:", {
                    eventRoomId: data.roomId,
                    currentRoomId: roomId,
                });
            }
        };

        // Listen for the custom event dispatched by GlobalSocketManager
        window.addEventListener("liveKitCallEnded", handleCallEnded as EventListener);

        console.log("✅ VideoRoom: Set up call_ended custom event listener (via GlobalSocketManager)");

        return () => {
            // Clean up event listeners
            window.removeEventListener("liveKitCallEnded", handleCallEnded as EventListener);
        };
    }, [roomId, onLeave]);

    const { token, serverUrl, error, isConnecting, connect, roomOptions, checkRoom } = useRoom({
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
    });
    const connectionInitiated = useRef(false);
    const connectCalled = useRef(false);

    // Initial room check to detect ongoing calls
    useEffect(() => {
        if (!connectionInitiated.current) {
            connectionInitiated.current = true;

            // Check if user is accepting an incoming call (either via prop or recent acceptance detection)
            const isJoiningAcceptedCall =
                isAcceptingIncomingCall ||
                ((window as any).wasCallRecentlyAccepted && (window as any).wasCallRecentlyAccepted());

            if (isJoiningAcceptedCall) {
                console.log("📞 User is accepting/joining an incoming call - skipping confirmation dialog");

                // Stop incoming call sound
                if ((window as any).stopIncomingCallSound) {
                    (window as any).stopIncomingCallSound();
                }

                // Clear the recent acceptance flag if it was used
                if ((window as any).clearRecentCallAcceptance) {
                    (window as any).clearRecentCallAcceptance();
                }

                // Clear all call notifications
                if ((window as any).clearAllLiveKitCallNotifications) {
                    (window as any).clearAllLiveKitCallNotifications();
                }

                setConnectionApproved(true);
                if (!connectCalled.current) {
                    connectCalled.current = true;
                    console.log("🔗 First useEffect: Calling connect() - accepting incoming call");
                    connect();
                }
                return;
            }

            // SKIP room check if user is joining an ongoing call (already checked by RoomHeader)
            if (isJoiningOngoingCall) {
                console.log("📞 User is joining an ongoing call - skipping room check (already done by RoomHeader)");
                setConnectionApproved(true);
                if (!connectCalled.current) {
                    connectCalled.current = true;
                    console.log("🔗 First useEffect: Calling connect() - joining ongoing call");
                    connect();
                }
                return;
            }

            // Only check for ongoing calls if user is initiating a new call (not accepting or joining)
            checkRoom()
                .then((roomInfo: any) => {
                    if (roomInfo && roomInfo.participants && roomInfo.participants.length > 0) {
                        const onlineParticipants = roomInfo.participants.filter((p: any) => p.isOnline);
                        if (onlineParticipants.length > 0) {
                            console.log(
                                `🎯 Detected ongoing call with ${onlineParticipants.length} participants:`,
                                onlineParticipants,
                            );
                            setOngoingCallInfo({
                                participants: onlineParticipants,
                                participantCount: onlineParticipants.length,
                            });
                            setShowJoinConfirmation(true);
                            return; // Don't auto-connect
                        }
                    }

                    // No ongoing call detected, proceed normally
                    console.log("✅ No ongoing call detected, connecting normally");
                    setConnectionApproved(true);
                    if (!connectCalled.current) {
                        connectCalled.current = true;
                        console.log("🔗 First useEffect: Calling connect() - no ongoing call");
                        connect();
                    }
                })
                .catch((err: any) => {
                    console.warn("⚠️ Failed to check room status, proceeding with connection:", err);
                    setConnectionApproved(true);
                    if (!connectCalled.current) {
                        connectCalled.current = true;
                        console.log("🔗 First useEffect: Calling connect() - room check failed");
                        connect();
                    }
                });
        }
    }, [checkRoom, connect, isAcceptingIncomingCall, isJoiningOngoingCall]);

    // Connect after user approves joining ongoing call
    useEffect(() => {
        if (connectionApproved && !token && !isConnecting && !connectCalled.current) {
            connectCalled.current = true;
            console.log("🔗 Second useEffect: Calling connect() after approval (joining ongoing call)");
            connect();
        }
    }, [connectionApproved, connect, token, isConnecting]);

    // Set call as active when component mounts and clears when unmounts
    useEffect(() => {
        // Set call as active when VideoRoom is mounted
        if ((window as any).setCallActiveState) {
            (window as any).setCallActiveState(true);
            console.log("📞 VideoRoom: Set call active state to TRUE");
        } else {
            console.warn("⚠️ VideoRoom: setCallActiveState function not available");
        }

        // Clear call state when component unmounts
        return () => {
            if ((window as any).setCallActiveState) {
                (window as any).setCallActiveState(false);
                console.log("📞 VideoRoom: Set call active state to FALSE on unmount");
            }

            // Also clear recent call acceptance flag on unmount
            if ((window as any).clearRecentCallAcceptance) {
                (window as any).clearRecentCallAcceptance();
            }
        };
    }, []);

    // Show join confirmation dialog if ongoing call detected
    if (showJoinConfirmation && ongoingCallInfo) {
        const handleJoinCall = (): void => {
            console.log("🎯 User chose to join ongoing call");
            setShowJoinConfirmation(false);
            setConnectionApproved(true);

            // Immediately trigger connection for joining ongoing calls
            if (!connectCalled.current) {
                connectCalled.current = true;
                console.log("🔗 handleJoinCall: Immediately calling connect() for ongoing call join");
                connect();
            }
        };

        const handleDeclineJoin = (): void => {
            console.log("🎯 User declined to join ongoing call");
            setShowJoinConfirmation(false);
            onLeave?.(); // Close the modal
        };

        const getParticipantNames = (): string => {
            if (ongoingCallInfo.participantCount === 1) {
                return ongoingCallInfo.participants[0]?.username || "1 participant";
            } else if (ongoingCallInfo.participantCount === 2) {
                return ongoingCallInfo.participants.map((p) => p.username).join(" and ");
            } else {
                return `${ongoingCallInfo.participantCount} participants`;
            }
        };

        return (
            <div className="professional-loading">
                <div style={{ fontSize: "48px", marginBottom: "24px", color: "#4285f4" }}>📞</div>
                <h3 style={{ margin: "0 0 16px 0", color: "white", fontSize: "24px" }}>Ongoing Call Detected</h3>
                <p
                    style={{
                        margin: "0 0 8px 0",
                        opacity: 0.9,
                        textAlign: "center",
                        maxWidth: "400px",
                        fontSize: "16px",
                    }}
                >
                    {getParticipantNames()} {ongoingCallInfo.participantCount === 1 ? "is" : "are"} currently in a{" "}
                    {isVideo ? "video" : "voice"} call.
                </p>
                <p
                    style={{
                        margin: "0 0 32px 0",
                        opacity: 0.7,
                        textAlign: "center",
                        maxWidth: "400px",
                        fontSize: "14px",
                    }}
                >
                    Would you like to join the ongoing call?
                </p>
                <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                    <button
                        onClick={handleDeclineJoin}
                        style={{
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.3)",
                            borderRadius: "8px",
                            color: "white",
                            padding: "12px 24px",
                            fontSize: "16px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleJoinCall}
                        style={{
                            background: "linear-gradient(135deg, #4285f4 0%, #34a853 100%)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            padding: "12px 24px",
                            fontSize: "16px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            fontWeight: "600",
                        }}
                    >
                        Join Call
                    </button>
                </div>
            </div>
        );
    }

    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const maxReconnectAttempts = 3;
    const reconnectDelay = 2000; // 2 seconds

    useEffect(() => {
        let reconnectTimer: NodeJS.Timeout;

        if (error && reconnectAttempts < maxReconnectAttempts) {
            console.log(`🔄 Attempting automatic reconnection (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            reconnectTimer = setTimeout(() => {
                connectionInitiated.current = false;
                connectCalled.current = false;
                connect();
                setReconnectAttempts((prev) => prev + 1);
            }, reconnectDelay);
        }

        return () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
        };
    }, [error, reconnectAttempts]);

    if (error) {
        return (
            <div className="professional-loading">
                <div style={{ fontSize: "48px", marginBottom: "16px", color: "#f44336" }}>⚠️</div>
                <h3 style={{ margin: "0 0 16px 0", color: "#f44336" }}>Connection Error</h3>
                <p style={{ margin: "0 0 24px 0", opacity: 0.8, textAlign: "center", maxWidth: "400px" }}>
                    {error}
                    {reconnectAttempts > 0 && reconnectAttempts < maxReconnectAttempts && (
                        <span>
                            <br />
                            Attempting to reconnect... ({reconnectAttempts}/{maxReconnectAttempts})
                        </span>
                    )}
                </p>
                {reconnectAttempts >= maxReconnectAttempts && (
                    <button
                        onClick={(): void => {
                            setReconnectAttempts(0);
                            connectionInitiated.current = false;
                            connectCalled.current = false;
                            console.log("🔗 Manual reconnection attempt");
                            connect();
                        }}
                        style={{
                            background: "linear-gradient(135deg, #4285f4 0%, #34a853 100%)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            padding: "12px 24px",
                            fontSize: "16px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                        }}
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    if (isConnecting) {
        return (
            <div className="professional-loading">
                <div className="loading-spinner" />
                <div style={{ fontSize: "18px", fontWeight: 500 }}>Connecting to call...</div>
                <div style={{ fontSize: "14px", opacity: 0.7, marginTop: "8px" }}>
                    Please wait while we establish the connection
                </div>
            </div>
        );
    }

    if (!token || !serverUrl || !roomOptions) {
        return (
            <div className="professional-loading">
                <div className="loading-spinner" />
                <div style={{ fontSize: "18px", fontWeight: 500 }}>Preparing call...</div>
                <div style={{ fontSize: "14px", opacity: 0.7, marginTop: "8px" }}>Setting up room and security</div>
            </div>
        );
    }

    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            options={roomOptions}
            connect={true}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background:
                    "linear-gradient(135deg, rgba(15, 15, 15, 0.85) 0%, rgba(26, 26, 26, 0.85) 100%), url('/img/Call-wallpaper.jpg') center/cover no-repeat",
            }}
            onConnected={(): void => {
                console.log("Connected to room successfully");
                console.log("Server URL:", serverUrl);

                // Stop any lingering incoming call sounds once connected
                if ((window as any).stopIncomingCallSound) {
                    (window as any).stopIncomingCallSound();
                }
            }}
            onDisconnected={(reason): void => {
                console.log("🚪 Room disconnected, reason:", reason);

                // Check if this is a manual disconnect by the only participant
                if (!isAutoEndingCall) {
                    console.log("📞 Manual disconnect, handling normally");

                    // Check if user was the only participant and emit CALL_ENDED if needed
                    const currentRoomData = (window as any).__currentLiveKitRoomData;
                    const incomingCallData = (window as any).__incomingCallData;
                    const globalActiveCallData = (window as any).__globalActiveCallData;

                    console.log("📞 DEBUG: Checking all room data sources:");
                    console.log("📞 currentRoomData:", currentRoomData);
                    console.log("📞 incomingCallData:", incomingCallData);
                    console.log("📞 globalActiveCallData:", globalActiveCallData);

                    // If incoming call data was already cleared, try to reconstruct from stored room props
                    // Priority: currentRoomData > incomingCallData > globalActiveCallData (for home screen accepted calls)
                    let roomData = currentRoomData || incomingCallData;

                    // Special handling for calls accepted from home screen - use globalActiveCallData
                    if (!roomData && globalActiveCallData && isAcceptingIncomingCall) {
                        console.log("📞 Using globalActiveCallData for home screen accepted call");
                        // Convert globalActiveCallData format to expected roomData format
                        roomData = {
                            roomId: globalActiveCallData.roomId,
                            toUserIds: toUserIds || [],
                            toUsernames: toUsernames || {},
                            fromUsername: fromUsername,
                            groupName: groupName,
                            isVideo: globalActiveCallData.callType === "video",
                        };
                    }

                    // Fallback: If both are null/empty, use the component props for incoming calls
                    if ((!roomData || !roomData.roomId) && isAcceptingIncomingCall) {
                        console.log("📞 Room data missing, reconstructing from component props for incoming call");
                        roomData = {
                            roomId: roomId,
                            toUserIds: toUserIds || [],
                            toUsernames: toUsernames || {},
                            fromUsername: fromUsername,
                            groupName: groupName,
                            isVideo: isVideo,
                        };
                    }

                    const currentParticipantCount = (window as any).__currentParticipantCount || 0;
                    console.log("📞 Room data for disconnect check:", {
                        roomData,
                        isAcceptingIncomingCall,
                        hasRoomId: !!roomData?.roomId,
                        hasToUserIds: !!roomData?.toUserIds,
                        toUserIdsLength: roomData?.toUserIds?.length,
                        participantCount: currentParticipantCount,
                        dataSource: currentRoomData
                            ? "currentRoomData"
                            : incomingCallData
                              ? "incomingCallData"
                              : globalActiveCallData
                                ? "globalActiveCallData"
                                : "reconstructedFromProps",
                        reconstructedFromProps:
                            !currentRoomData && !incomingCallData && !globalActiveCallData && isAcceptingIncomingCall,
                    });

                    // Handle different disconnect scenarios based on participant count
                    if (roomData?.roomId) {
                        if (currentParticipantCount <= 1) {
                            // Last participant leaving - emit CALL_ENDED (only if not accepting incoming call)
                            if (roomData?.toUserIds && !isAcceptingIncomingCall) {
                                console.log("📞 Manual disconnect as last participant - emitting CALL_ENDED event");
                                console.log("📞 CALL_ENDED event data:", {
                                    roomId: roomData.roomId,
                                    toUserIds: roomData.toUserIds,
                                    fromUsername: roomData.fromUsername,
                                    participantCount: currentParticipantCount,
                                });

                                emitCallEndedEvent(roomData.roomId, roomData.toUserIds).catch((err) =>
                                    console.error("Failed to emit call ended event on disconnect:", err),
                                );
                            } else {
                                console.log("📞 No CALL_ENDED emission - accepting incoming call", {
                                    isAcceptingIncomingCall,
                                    participantCount: currentParticipantCount,
                                });
                            }
                        } else {
                            // Not the last participant - emit USER_LEFT_CALL to clean up backend state
                            console.log(
                                "📞 Manual disconnect but not last participant - emitting USER_LEFT_CALL event",
                            );
                            console.log("📞 USER_LEFT_CALL event data:", {
                                roomId: roomData.roomId,
                                participantCount: currentParticipantCount,
                            });

                            emitUserLeftCallEvent(roomData.roomId).catch((err) =>
                                console.error("Failed to emit user left call event on disconnect:", err),
                            );
                        }
                    } else {
                        console.log("📞 No events emitted - missing room data", {
                            hasRoomData: !!roomData,
                            hasRoomId: !!roomData?.roomId,
                            participantCount: currentParticipantCount,
                        });
                    }
                } else {
                    console.log("📞 Auto-end detected, clearing notifications and showing no-answer message");
                    // Dispatch timeout event instead of decline
                    window.dispatchEvent(new CustomEvent("liveKitCallTimeout"));
                    isAutoEndingCall = false; // Reset flag
                }

                console.log("📞 Calling onLeave callback to close modal");
                connectionInitiated.current = false; // Reset on disconnect
                onLeave?.();
            }}
            onError={(err): void => {
                console.error("❌ Room connection error:", err);
                console.log("📞 Calling onLeave callback due to error");
                connectionInitiated.current = false; // Reset on error
                // onLeave?.();
            }}
        >
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <RoomContent isVideo={isVideo} />
            </div>
        </LiveKitRoom>
    );
};
