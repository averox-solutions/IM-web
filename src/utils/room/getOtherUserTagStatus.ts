/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import DMRoomMap from "../DMRoomMap";

export interface TagStatusResponse {
    tags?: {
        [tagName: string]: {
            order?: number;
        };
    };
    is_favourite?: boolean;
    is_lowpriority?: boolean;
    is_server_notice?: boolean;
    custom_tags?: string[];
    tag_count?: number;
}

/**
 * Fetches the tag status for the other user in a 1-1 chat room
 * @param client The Matrix client
 * @param room The room (should be a 1-1 chat)
 * @returns Promise resolving to the tag status or null if not available
 */
export async function getOtherUserTagStatus(
    client: MatrixClient,
    room: Room,
): Promise<TagStatusResponse | null> {
    try {
        // Get the other user's ID from the DM room map
        let otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
        
        if (!otherUserId) {
            // If not in DM map, try to find the other user by checking room members
            const myUserId = client.getSafeUserId();
            const otherMember = room.getJoinedMembers().find(m => m.userId !== myUserId);
            
            if (!otherMember) {
                logger.warn(`Could not find other user in room ${room.roomId}`);
                return null;
            }
            
            // Use the found member's user ID
            otherUserId = otherMember.userId;
        }
        
        // The path should be relative to /_matrix/client/v3
        // New custom endpoint format (server-side):
        //   /_matrix/client/v3/user/{userId}/rooms/{roomId}/tag_check
        const path = `/user/${encodeURIComponent(otherUserId)}/rooms/${encodeURIComponent(
            room.roomId,
        )}/tag_check`;
        
        logger.log(`Fetching tag status (tag_check) from: ${path}`);
        logger.log(`Other user ID: ${otherUserId}, Room ID: ${room.roomId}`);
        
        // Verify client has access token
        const accessToken = client.getAccessToken();
        if (!accessToken) {
            logger.error("MatrixClient does not have an access token. Cannot make authenticated request.");
            return null;
        }
        logger.log("Access token available, making authenticated request");
        
        // Build the full URL with base URL
        const baseUrl = client.baseUrl;
        const fullUrl = `${baseUrl}/_matrix/client/v3${path}`;
        
        logger.log(`Making authenticated request to: ${fullUrl}`);
        
        // Use fetch directly to ensure Authorization header is sent
        const fetchResponse = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            logger.error(`HTTP ${fetchResponse.status}: ${errorText}`);
            throw new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
        }
        
        const response = await fetchResponse.json();
        
        logger.log("Other user tag status raw response (tag_check):", JSON.stringify(response, null, 2));
        
        // Support both formats:
        // 1) { rooms: { roomId: { tags: {...}, ... } }, total_count: number }
        // 2) { tags: {...}, is_favourite: bool, ... } directly for the room
        let roomData: any = null;
        if (response?.rooms) {
            roomData = response.rooms[room.roomId];
        } else {
            roomData = response;
        }

        if (!roomData) {
            logger.log(`No tag data found for room ${room.roomId} in tag_check response`);
            return null;
        }
        
        // Extract tags and status information
        const tags = roomData.tags || {};
        const formattedResponse: TagStatusResponse = {
            tags: tags,
            is_favourite: roomData.is_favourite || false,
            is_lowpriority: roomData.is_lowpriority || false,
            is_server_notice: roomData.is_server_notice || false,
            custom_tags: roomData.custom_tags || [],
            tag_count: roomData.tag_count || 0,
        };
        
        logger.log("Formatted tag status response:", JSON.stringify(formattedResponse, null, 2));
        
        if (tags && Object.keys(tags).length > 0) {
            logger.log(`Successfully fetched ${Object.keys(tags).length} tag(s) for other user ${otherUserId} in room ${room.roomId}`);
        } else {
            logger.log(`No tags found for other user ${otherUserId} in room ${room.roomId}`);
        }
        
        return formattedResponse;
    } catch (error: any) {
        // Check if it's an API error
        if (error?.errcode === "M_UNRECOGNIZED" || error?.errcode === "M_NOT_FOUND" || error?.httpStatus === 404) {
            logger.warn(
                `The tag_check endpoint is not recognized by the server (404). ` +
                `This endpoint should be available on your Synapse server. ` +
                `Error: ${error.error || error.message || JSON.stringify(error)}`
            );
        } else {
            logger.error("Failed to fetch other user's tag status:", error);
        }
        return null;
    }
}
