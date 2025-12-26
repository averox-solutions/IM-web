/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type IEventRelation,
    type MatrixError,
    THREAD_RELATION_TYPE,
    ContentHelpers,
    LocationAssetType,
} from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import QuestionDialog, { type IQuestionDialogProps } from "../dialogs/QuestionDialog";
import SdkConfig from "../../../SdkConfig";
import { OwnBeaconStore } from "../../../stores/OwnBeaconStore";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import { parseGeoUri } from "../../../utils/location/parseGeoUri";
import { fetchUserTokenAndPlatform } from "../../../utils/userdetails";
import { checkAndUpdateTagsAfterMessage } from "../rooms/wysiwyg_composer/utils/message";

export enum LocationShareType {
    Own = "Own",
    Pin = "Pin",
    Live = "Live",
}

export type LocationShareProps = {
    timeout?: number;
    uri?: string;
    timestamp?: number;
};

// default duration to 5min for now
const DEFAULT_LIVE_DURATION = 300000;

const NOTIFICATION_API_BASE_URL =
    process.env.REACT_APP_NOTIFCATIONURL || "http://localhost:4000";

export type ShareLocationFn = (props: LocationShareProps) => Promise<void>;

const getPermissionsErrorParams = (
    shareType: LocationShareType,
): {
    errorMessage: string;
    modalParams: IQuestionDialogProps;
} => {
    const errorMessage =
        shareType === LocationShareType.Live
            ? "Insufficient permissions to start sharing your live location"
            : "Insufficient permissions to send your location";

    const modalParams = {
        title: _t("location_sharing|error_no_perms_title"),
        description: _t("location_sharing|error_no_perms_description"),
        button: _t("action|ok"),
        hasCancelButton: false,
        onFinished: () => {}, // NOOP
    };
    return { modalParams, errorMessage };
};

const getDefaultErrorParams = (
    shareType: LocationShareType,
    openMenu: () => void,
): {
    errorMessage: string;
    modalParams: IQuestionDialogProps;
} => {
    const errorMessage =
        shareType === LocationShareType.Live
            ? "We couldn't start sharing your live location"
            : "We couldn't send your location";
    const modalParams = {
        title: _t("location_sharing|error_send_title"),
        description: _t("location_sharing|error_send_description", {
            brand: SdkConfig.get().brand,
        }),
        button: _t("action|try_again"),
        cancelButton: _t("action|cancel"),
        onFinished: (tryAgain: boolean) => {
            if (tryAgain) {
                openMenu();
            }
        },
    };
    return { modalParams, errorMessage };
};

const handleShareError = (error: unknown, openMenu: () => void, shareType: LocationShareType): void => {
    const { modalParams, errorMessage } =
        (error as MatrixError).errcode === "M_FORBIDDEN"
            ? getPermissionsErrorParams(shareType)
            : getDefaultErrorParams(shareType, openMenu);

    logger.error(errorMessage, error);

    Modal.createDialog(QuestionDialog, modalParams);
};

export const shareLiveLocation =
    (client: MatrixClient, roomId: string, displayName: string, openMenu: () => void): ShareLocationFn =>
    async ({ timeout }): Promise<void> => {
        const description = _t("location_sharing|live_description", { displayName });
        try {
            await OwnBeaconStore.instance.createLiveBeacon(
                roomId,
                ContentHelpers.makeBeaconInfoContent(
                    timeout ?? DEFAULT_LIVE_DURATION,
                    true /* isLive */,
                    description,
                    LocationAssetType.Self,
                ),
            );
        } catch (error) {
            handleShareError(error, openMenu, LocationShareType.Live);
        }
    };

/**
 * Format coordinates into a human-readable location description
 */
const formatLocationDescription = (uri: string): string => {
    const coords = parseGeoUri(uri);
    if (!coords) {
        return uri; // Fallback to original URI if parsing fails
    }
    
    const lat = coords.latitude.toFixed(6);
    const lon = coords.longitude.toFixed(6);
    const latDir = coords.latitude >= 0 ? "N" : "S";
    const lonDir = coords.longitude >= 0 ? "E" : "W";
    
    return `${_t("location_sharing|shared_location")} (${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(parseFloat(lon))}°${lonDir})`;
};

/**
 * Format coordinates into just the location text (coordinates only)
 */
const formatLocationText = (uri: string): string => {
    const coords = parseGeoUri(uri);
    if (!coords) {
        return uri; // Fallback to original URI if parsing fails
    }
    
    const lat = coords.latitude.toFixed(6);
    const lon = coords.longitude.toFixed(6);
    const latDir = coords.latitude >= 0 ? "N" : "S";
    const lonDir = coords.longitude >= 0 ? "E" : "W";
    
    return `(${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(parseFloat(lon))}°${lonDir})`;
};

/**
 * Send FCM notifications to room members when a location is shared
 */
const sendLocationShareNotifications = async (
    client: MatrixClient,
    roomId: string,
    uri: string,
): Promise<void> => {
    try {
        const room = client.getRoom(roomId);
        if (!room) {
            logger.warn(`Room ${roomId} not found for location share notification`);
            return;
        }

        const fullId = client.getSafeUserId();
        if (!fullId) {
            logger.warn("No user ID available for location share notification");
            return;
        }

        // Get sender display name
        const sender = room.getMember(fullId);
        const senderDisplayName = sender?.name || sender?.rawDisplayName || fullId.split(":")[0]?.slice(1) || "Someone";
        
        // Format location text (coordinates only)
        const locationText = 'Location';
        
        // Get all other members in the room
        const others = room.getJoinedMembers().filter((m) => m.userId !== fullId);

        // Send notification to each member
        for (const member of others) {
            try {
                await fetchUserTokenAndPlatform(member.userId);
                await fetch(`${NOTIFICATION_API_BASE_URL}/send-notification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: member.userId,
                        notificationTitle: senderDisplayName,
                        notificationBody: locationText,
                    }),
                });
            } catch (err) {
                logger.warn(`Failed to send FCM location notification to ${member.userId}:`, err);
            }
        }
    } catch (error) {
        logger.error("Error sending location share notifications:", error);
    }
};

export const shareLocation =
    (
        client: MatrixClient,
        roomId: string,
        shareType: LocationShareType,
        relation: IEventRelation | undefined,
        openMenu: () => void,
    ): ShareLocationFn =>
    async ({ uri, timestamp }): Promise<void> => {
        if (!uri) return;
        try {
            const threadId = (relation?.rel_type === THREAD_RELATION_TYPE.name && relation?.event_id) || null;
            const assetType = shareType === LocationShareType.Pin ? LocationAssetType.Pin : LocationAssetType.Self;
            const content = ContentHelpers.makeLocationContent(
                undefined,
                uri,
                timestamp,
                undefined,
                assetType,
            ) as RoomMessageEventContent;
            
            // Enhance body text with human-readable location description
            // This helps clients that can't render maps (like FluffyChat) show a better fallback
            const locationDescription = formatLocationDescription(uri);
            content.body = `${locationDescription}\n${uri}`;
            
            await doMaybeLocalRoomAction(
                roomId,
                (actualRoomId: string) => client.sendMessage(actualRoomId, threadId, content),
                client,
            );

            // Check and update tags after location is sent (remove "1-1 Leave Chat" tag if present)
            checkAndUpdateTagsAfterMessage(client, roomId).catch((error) => {
                logger.error("Error checking and updating tags after location:", error);
            });

            // Send FCM notifications to room members (with location text only)
            await sendLocationShareNotifications(client, roomId, uri);
        } catch (error) {
            handleShareError(error, openMenu, shareType);
        }
    };
