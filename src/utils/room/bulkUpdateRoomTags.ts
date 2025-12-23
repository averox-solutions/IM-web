/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

export interface BulkTagOperation {
    room_id: string;
    action: "add" | "remove";
    tag: string;
    content?: {
        order?: number;
    };
}

export interface BulkTagUpdateRequest {
    operations: BulkTagOperation[];
}

export interface BulkTagUpdateResponse {
    success: Array<{
        room_id: string;
        tag: string;
        action: string;
    }>;
    failed: Array<{
        room_id: string;
        tag: string;
        action: string;
        error?: string;
    }>;
    success_count: number;
    failed_count: number;
}

/**
 * Updates room tags in bulk using the bulk_tag_update API
 * @param client The Matrix client
 * @param targetUserId The user whose tags should be updated (as per backend spec)
 * @param operations Array of tag operations to perform
 * @returns Promise resolving to the update response
 */
export async function bulkUpdateRoomTags(
    client: MatrixClient,
    targetUserId: string,
    operations: BulkTagOperation[],
): Promise<BulkTagUpdateResponse | null> {
    try {
        if (operations.length === 0) {
            logger.warn("No tag operations to perform");
            return null;
        }

        const accessToken = client.getAccessToken();
        if (!accessToken) {
            logger.error("MatrixClient does not have an access token. Cannot make authenticated request.");
            return null;
        }

        const baseUrl = client.baseUrl;
        // Backend expects: /_matrix/client/v3/user/{targetUserId}/rooms/bulk_tag_update
        const path = `/user/${encodeURIComponent(targetUserId)}/rooms/bulk_tag_update`;
        const fullUrl = `${baseUrl}/_matrix/client/v3${path}`;

        const requestBody: BulkTagUpdateRequest = {
            operations,
        };

        logger.log(`Bulk updating tags: ${JSON.stringify(requestBody, null, 2)}`);

        const fetchResponse = await fetch(fullUrl, {
            // Backend expects POST for bulk_tag_update
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            logger.error(`HTTP ${fetchResponse.status}: ${errorText}`);
            throw new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
        }

        const response: BulkTagUpdateResponse = await fetchResponse.json();
        logger.log(`Bulk tag update response: ${JSON.stringify(response, null, 2)}`);

        return response;
    } catch (error: any) {
        logger.error("Failed to bulk update room tags:", error);
        return null;
    }
}

