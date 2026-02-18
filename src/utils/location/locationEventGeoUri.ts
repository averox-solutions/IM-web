/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, M_LOCATION } from "matrix-js-sdk/src/matrix";

/**
 * Find the geo-URI contained within a location event.
 * Returns a string so coordinates can be passed to the map; empty string if none found.
 */
export const locationEventGeoUri = (mxEvent: MatrixEvent): string => {
    const content = mxEvent.getContent();
    if (!content || typeof content !== "object") return "";

    const loc = M_LOCATION.findIn(content) as { uri?: string } | undefined;
    if (loc?.uri && typeof loc.uri === "string") {
        return loc.uri.trim();
    }
    const geoUri = content["geo_uri"];
    if (typeof geoUri === "string") return geoUri.trim();
    // Legacy / FluffyChat: some clients send m.location with uri
    const mLoc = content["m.location"] as { uri?: string } | undefined;
    if (mLoc?.uri && typeof mLoc.uri === "string") return mLoc.uri.trim();
    return "";
};
