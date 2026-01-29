/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Clean a geo URI by removing any parameters (like uncertainty)
 * to ensure compatibility with legacy clients like FluffyChat.
 *
 * @param uri The geo URI to clean (e.g. "geo:51.5074,-0.1278;u=10")
 * @returns The cleaned geo URI (e.g. "geo:51.5074,-0.1278")
 */
export const cleanGeoUri = (uri: string): string => {
    if (!uri) return uri;
    // Split by semicolon to remove parameters
    const parts = uri.split(";");
    return parts[0];
};
