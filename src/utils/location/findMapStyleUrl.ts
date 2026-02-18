/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../SdkConfig";
import { getTileServerWellKnown } from "../WellKnownUtils";

/**
 * Look up what map tile server style URL was provided in the homeserver's
 * .well-known location, or, failing that, in our local config, or, failing
 * that, defaults to the same tile server listed by matrix.org.
 */
export function findMapStyleUrl(matrixClient: MatrixClient): any {
    const mapStyleUrl = getTileServerWellKnown(matrixClient)?.map_style_url ?? SdkConfig.get().map_style_url;

    if (!mapStyleUrl) {
        return {
            version: 8,
            sources: {
                "osm-tiles": {
                    type: "raster",
                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
            },
            layers: [
                {
                    id: "osm-tiles",
                    type: "raster",
                    source: "osm-tiles",
                    minzoom: 0,
                    maxzoom: 19,
                },
            ],
        };
    }

    return mapStyleUrl;
}
