/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// LiveKit Configuration
// In a real implementation, this should come from your backend/config service
// const LIVEKIT_API_BASE_URL = process.env.REACT_APP_LIVEKIT_API_URL || "http://localhost:3000";
const LIVEKIT_API_BASE_URL = "https://lk-130.averox.com/api/";
// const LIVEKIT_API_BASE_URL = "http://localhost:3000";

export const CREATE_ROOM_ENDPOINT = `${LIVEKIT_API_BASE_URL}/create-room`;
export const GET_ROOM_KEY_ENDPOINT = `${LIVEKIT_API_BASE_URL}/room-key`;

// LiveKit Server Configuration
export const LIVEKIT_SERVER_CONFIG = {
    // These should be configured in your backend
    // defaultServerUrl: process.env.REACT_APP_LIVEKIT_SERVER_URL || "ws://localhost:7880",
    defaultServerUrl: "wss://lk-130.averox.com/rtc",
    // defaultServerUrl: "ws://localhost:7880",
    // Add other server configurations as needed
};
