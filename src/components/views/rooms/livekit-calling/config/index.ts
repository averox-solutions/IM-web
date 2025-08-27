/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// LiveKit Configuration
// In a real implementation, this should come from your backend/config service
const LIVEKIT_API_BASE_URL = process.env.REACT_APP_LIVEKIT_API_URL || "https://lk-auth.bservices-api.org.pk/api";
// const LIVEKIT_API_BASE_URL = "https://lk-auth.bservices-api.org.pk";
// const LIVEKIT_API_BASE_URL = "https://lk-auth.bservices-api.org.pk";

export const CREATE_ROOM_ENDPOINT = `${LIVEKIT_API_BASE_URL}/create-room`;
export const GET_ROOM_KEY_ENDPOINT = `${LIVEKIT_API_BASE_URL}/room-key`;

// LiveKit Server Configuration
export const LIVEKIT_SERVER_CONFIG = {
    defaultServerUrl:
        process.env.REACT_APP_LIVEKIT_SERVER_URL ||
        (process.env.NODE_ENV === "production" ? "wss://lk-auth.bservices-api.org.pk/livekit/sfu" : "ws://localhost:7880"),
    // Additional configurations
    reconnectAttempts: 3,
    reconnectTimeout: 10000, // 10 seconds
    autoReconnect: true,
};
