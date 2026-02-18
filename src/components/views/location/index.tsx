/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Export location components. Lazy loading Map/SmartMarker caused "r.default is not a constructor"
// when opening the big map (chunk 9963), so we use direct imports.

import React, { type ComponentProps } from "react";

import MapComponent from "./Map";
import SmartMarkerComponent from "./SmartMarker";
import LocationViewDialogComponent from "./LocationViewDialog";

export function Map(props: ComponentProps<typeof MapComponent>): React.ReactElement {
    return <MapComponent {...props} />;
}

export function SmartMarker(props: ComponentProps<typeof SmartMarkerComponent>): React.ReactElement {
    return <SmartMarkerComponent {...props} />;
}

// LocationButton stays lazy to avoid pulling map code into the main bundle until needed.
const LocationButtonComponent = React.lazy(() => import("./LocationButton"));

export function LocationButton(props: ComponentProps<typeof LocationButtonComponent>): React.ReactElement {
    return (
        <React.Suspense fallback={null}>
            <LocationButtonComponent {...props} />
        </React.Suspense>
    );
}

export function LocationViewDialog(
    props: ComponentProps<typeof LocationViewDialogComponent>,
): React.ReactElement {
    return <LocationViewDialogComponent {...props} />;
}
