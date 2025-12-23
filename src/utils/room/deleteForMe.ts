/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

export interface DeletedEventsResponse {
    deleted_events: string[];
    room_id: string;
    count: number;
}

export interface BulkDeleteEventsRequest {
    event_ids?: string[];
    delete_all?: boolean;
}

function getAuthData(client: MatrixClient): { baseUrl: string; userId: string; accessToken: string } | null {
    const baseUrl = client.baseUrl;
    const accessToken = client.getAccessToken();
    const userId = client.getUserId();

    if (!baseUrl || !accessToken || !userId) {
        logger.error(
            "[deleteForMe] Missing auth data",
            JSON.stringify({ hasBaseUrl: !!baseUrl, hasAccessToken: !!accessToken, hasUserId: !!userId }),
        );
        return null;
    }

    return { baseUrl, userId, accessToken };
}

export async function fetchDeletedEventsForRoom(
    client: MatrixClient,
    roomId: string,
): Promise<DeletedEventsResponse | null> {
    const auth = getAuthData(client);
    if (!auth) return null;

    const { baseUrl, userId, accessToken } = auth;

    const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/deleted_events`;
    const url = `${baseUrl}/_matrix/client/v3${path}`;

    try {
        logger.log(`[deleteForMe] Fetching deleted events for room ${roomId}: ${url}`);
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!res.ok) {
            const text = await res.text();
            logger.error(`[deleteForMe] GET deleted_events failed: HTTP ${res.status}: ${text}`);
            return null;
        }

        const data = (await res.json()) as DeletedEventsResponse;
        logger.log(`[deleteForMe] Deleted events for room ${roomId}: ${JSON.stringify(data, null, 2)}`);
        return data;
    } catch (e) {
        logger.error("[deleteForMe] Error fetching deleted events", e);
        return null;
    }
}

export async function deleteEventForMe(
    client: MatrixClient,
    roomId: string,
    eventId: string,
    reason?: string,
): Promise<boolean> {
    const auth = getAuthData(client);
    if (!auth) return false;

    const { baseUrl, userId, accessToken } = auth;

    const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/events/${encodeURIComponent(
        eventId,
    )}`;
    const url = `${baseUrl}/_matrix/client/v3${path}`;

    try {
        const body = reason ? JSON.stringify({ reason }) : undefined;

        logger.log(
            `[deleteForMe] Deleting event for me. roomId=${roomId}, eventId=${eventId}, reason=${reason ?? "N/A"}`,
        );

        const res = await fetch(url, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body,
        });

        if (!res.ok) {
            const text = await res.text();
            logger.error(`[deleteForMe] DELETE failed: HTTP ${res.status}: ${text}`);
            return false;
        }

        const data = await res.json();
        logger.log(`[deleteForMe] Delete-for-me response: ${JSON.stringify(data, null, 2)}`);
        return !!data.deleted;
    } catch (e) {
        logger.error("[deleteForMe] Error deleting event for me", e);
        return false;
    }
}

export async function restoreEventForMe(client: MatrixClient, roomId: string, eventId: string): Promise<boolean> {
    const auth = getAuthData(client);
    if (!auth) return false;

    const { baseUrl, userId, accessToken } = auth;

    const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(
        roomId,
    )}/events/${encodeURIComponent(eventId)}/restore`;
    const url = `${baseUrl}/_matrix/client/v3${path}`;

    try {
        logger.log(`[deleteForMe] Restoring event for me. roomId=${roomId}, eventId=${eventId}`);

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!res.ok) {
            const text = await res.text();
            logger.error(`[deleteForMe] POST restore failed: HTTP ${res.status}: ${text}`);
            return false;
        }

        const data = await res.json();
        logger.log(`[deleteForMe] Restore-for-me response: ${JSON.stringify(data, null, 2)}`);
        return !!data.restored;
    } catch (e) {
        logger.error("[deleteForMe] Error restoring event for me", e);
        return false;
    }
}

export async function bulkDeleteEventsForMe(
    client: MatrixClient,
    roomId: string,
    body: BulkDeleteEventsRequest,
): Promise<boolean> {
    const auth = getAuthData(client);
    if (!auth) return false;

    const { baseUrl, userId, accessToken } = auth;

    const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/bulk_delete_events`;
    const url = `${baseUrl}/_matrix/client/v3${path}`;

    try {
        logger.log(
            `[deleteForMe] Bulk deleting events for room ${roomId}: ${JSON.stringify(body, null, 2)}`,
        );

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            logger.error(`[deleteForMe] POST bulk_delete_events failed: HTTP ${res.status}: ${text}`);
            return false;
        }

        const data = await res.json().catch(() => ({}));
        logger.log(`[deleteForMe] Bulk delete-for-me response: ${JSON.stringify(data, null, 2)}`);
        return true;
    } catch (e) {
        logger.error("[deleteForMe] Error bulk deleting events for me", e);
        return false;
    }
}
