/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";

import type * as maplibregl from "maplibre-gl";
import { parseGeoUri } from "../../../utils/location";
import { createMarker } from "../../../utils/location/map";
import Marker from "./Marker";

const useMapMarker = (
    map: maplibregl.Map,
    coords: { latitude: number; longitude: number } | undefined,
    isRoomMember: boolean,
): { marker?: maplibregl.Marker; onElementRef: (el: HTMLDivElement) => void } => {
    const [marker, setMarker] = useState<maplibregl.Marker>();
    const [element, setElement] = useState<HTMLDivElement | null>(null);

    const onElementRef = useCallback((el: HTMLDivElement | null) => {
        setElement(el);
    }, []);

    // Create marker when we have element and coords (single source of truth for position)
    useEffect(() => {
        if (!map || !element || !coords || marker) return;
        const options = isRoomMember
            ? { anchor: "center" as maplibregl.PositionAnchor, offset: [0, 0] as maplibregl.PointLike }
            : undefined;
        const newMarker = createMarker(
            coords as GeolocationCoordinates,
            element,
            options,
        );
        newMarker.addTo(map);
        setMarker(newMarker);
    }, [map, element, coords, isRoomMember, marker]);

    // Update marker position when coords change so pin and coordinates label stay on the same place
    useEffect(() => {
        if (marker && coords) {
            marker.setLngLat({ lng: coords.longitude, lat: coords.latitude });
        }
    }, [marker, coords]);

    // When element is unmounted (ref null), remove the marker from the map
    useEffect(() => {
        if (!element && marker) {
            marker.remove();
            setMarker(undefined);
        }
    }, [element, marker]);

    useEffect(
        () => () => {
            if (marker) {
                marker.remove();
            }
        },
        [marker],
    );

    return {
        marker,
        onElementRef,
    };
};

export interface SmartMarkerProps {
    map: maplibregl.Map;
    geoUri: string;
    id?: string;
    // renders MemberAvatar when provided
    roomMember?: RoomMember;
    // use member text color as background
    useMemberColor?: boolean;
    tooltip?: ReactNode;
}

/**
 * Generic location marker.
 * Parses geoUri once and uses the same coords for map position and coordinates label so they stay in sync.
 */
const SmartMarker: React.FC<SmartMarkerProps> = ({ id, map, geoUri, roomMember, useMemberColor, tooltip }) => {
    const coords = useMemo(() => parseGeoUri(geoUri), [geoUri]);
    const { onElementRef } = useMapMarker(map, coords, !!roomMember);

    return (
        // maplibregl hijacks the Marker dom element
        // and removes it from the dom when the maplibregl.Marker instance
        // is removed
        // wrap in a span so that react doesn't get confused
        // when trying to unmount this component
        <span>
            <Marker
                ref={onElementRef}
                id={id}
                roomMember={roomMember}
                useMemberColor={useMemberColor}
                tooltip={tooltip}
                coords={coords}
            />
        </span>
    );
};

export default SmartMarker;
