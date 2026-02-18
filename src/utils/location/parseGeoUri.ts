/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const parseGeoUri = (uri: string): GeolocationCoordinates | undefined => {
    if (uri == null || typeof uri !== "string") {
        return undefined;
    }
    const trimmed = uri.trim();
    if (!trimmed) return undefined;

    function parse(s: string): number | null {
        const ret = parseFloat(s);
        if (Number.isNaN(ret)) {
            return null;
        } else {
            return ret;
        }
    }

    // Standard: geo:lat,lon or geo:lat,lon;u=uncertainty (case-insensitive)
    let coordPart: string;
    const geoMatch = trimmed.match(/^\s*geo:(.+)$/i);
    if (geoMatch) {
        coordPart = geoMatch[1].trim();
    } else {
        // Fallback: raw "lat,lon" or "lat,lon;..." so coordinates still reach the map
        coordPart = trimmed;
    }
    const parts = coordPart.split(";");
    const coords = parts[0].split(",");
    if (coords.length < 2) return undefined;
    let uncertainty: number | null | undefined = undefined;
    for (const param of parts.slice(1)) {
        const uMatch = param.match(/u=(.*)/);
        if (uMatch) uncertainty = parse(uMatch[1]);
    }
    const latitude = parse(coords[0].trim());
    const longitude = parse(coords[1].trim());

    if (latitude === null || longitude === null) {
        return undefined;
    }

    const geoCoords = {
        latitude: latitude!,
        longitude: longitude!,
        altitude: parse(coords[2]),
        accuracy: uncertainty!,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
    };

    return {
        toJSON: () => geoCoords,
        ...geoCoords,
    };
};
