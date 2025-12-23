/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

export interface UpdateTagStatusPayload {
    room_id: string;
    tags?: {
        [tagName: string]: {
            order?: number;
        };
    };
    is_favourite?: boolean;
    is_lowpriority?: boolean;
    is_server_notice?: boolean;
    custom_tags?: string[];
}

export interface UpdateTagStatusResponse {
    success: boolean;
    message?: string;
}

/**
 * Updates the tag status for a room
 * @param client The Matrix client
 * @param room The room to update tags for
 * @param payload The tag status payload to update
 * @returns Promise resolving to the update response or null if failed
 */
export async function updateRoomTagStatus(
    client: MatrixClient,
    room: Room,
    payload: UpdateTagStatusPayload,
): Promise<UpdateTagStatusResponse | null> {
    try {
        // Verify client has access token
        const accessToken = client.getAccessToken();
        if (!accessToken) {
            logger.error("MatrixClient does not have an access token. Cannot make authenticated request.");
            return null;
        }

        // Build the full URL - PUT endpoint to update tag status
        const baseUrl = client.baseUrl;
        const userId = encodeURIComponent(client.getUserId()!);
        const path = `/user/${userId}/rooms/tag_status`;
        const fullUrl = `${baseUrl}/_matrix/client/v3${path}`;

        logger.log(`Updating tag status for room ${room.roomId}`);
        logger.log(`Request URL: ${fullUrl}`);
        logger.log(`Payload:`, JSON.stringify(payload, null, 2));

        // Use fetch directly to ensure Authorization header is sent
        const fetchResponse = await fetch(fullUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            logger.error(`HTTP ${fetchResponse.status}: ${errorText}`);
            throw new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
        }

        const response = await fetchResponse.json();
        logger.log("Tag status update response:", JSON.stringify(response, null, 2));

        return {
            success: true,
            message: response.message || "Tag status updated successfully",
        };
    } catch (error: any) {
        logger.error("Failed to update room tag status:", error);
        return {
            success: false,
            message: error?.message || "Failed to update tag status",
        };
    }
}

