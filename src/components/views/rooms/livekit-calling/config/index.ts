/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// LiveKit Configuration
// In a real implementation, this should come from your backend/config service
const LIVEKIT_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://lk-ccpl.stage-beep.org";
// const LIVEKIT_API_BASE_URL = "https://lk-ccpl.stage-beep.org";
// const LIVEKIT_API_BASE_URL = "https://lk-ccpl.stage-beep.org";

export const CREATE_ROOM_ENDPOINT = `${LIVEKIT_API_BASE_URL}/api/create-room`;
export const GET_ROOM_KEY_ENDPOINT = `${LIVEKIT_API_BASE_URL}/api/room-key`;

// LiveKit Server Configuration
export const LIVEKIT_SERVER_CONFIG = {
    defaultServerUrl:
        process.env.REACT_APP_BACKEND_URL ||
        (process.env.NODE_ENV === "production" ? "wss://lk-ccpl.stage-beep.org/livekit/sfu" : "ws://localhost:7880"),
    // Additional configurations
    reconnectAttempts: 3,
    reconnectTimeout: 10000, // 10 seconds
    autoReconnect: true,
};
