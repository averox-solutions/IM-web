/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useState } from "react";
import classNames from "classnames";
import { type RoomMember } from "matrix-js-sdk/src/matrix";

import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import MemberAvatar from "../avatars/MemberAvatar";

interface Props {
    id?: string;
    // renders MemberAvatar when provided
    roomMember?: RoomMember;
    // use member text color as background
    useMemberColor?: boolean;
    tooltip?: ReactNode;
    // when provided and roomMember is set (my location), show coordinates below the marker (same as pin position)
    coords?: { latitude: number; longitude: number };
}

/**
 * Wrap with tooltip handlers when
 * tooltip is truthy
 */
const OptionalTooltip: React.FC<{
    tooltip?: ReactNode;
    children: ReactNode;
}> = ({ tooltip, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    if (!tooltip) {
        return <>{children}</>;
    }

    const show = (): void => setIsVisible(true);
    const hide = (): void => setIsVisible(false);
    const toggleVisibility = (e: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
        // stop map from zooming in on click
        e.stopPropagation();
        setIsVisible(!isVisible);
    };

    return (
        <div onMouseEnter={show} onClick={toggleVisibility} onMouseLeave={hide}>
            {children}
            {isVisible && tooltip}
        </div>
    );
};

/**
 * Generic location marker
 */
const Marker = React.forwardRef<HTMLDivElement, Props>(({ id, roomMember, useMemberColor, tooltip, coords }, ref) => {
    const memberColorClass = useMemberColor && roomMember ? getUserNameColorClass(roomMember.userId) : "";
    const showLocationIconBelow =
        roomMember && coords && coords.latitude != null && coords.longitude != null;
    const coordinatesTitle = showLocationIconBelow
        ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
        : undefined;
    return (
        <div
            ref={ref}
            id={id}
            className={classNames("mx_Marker", memberColorClass, {
                mx_Marker_defaultColor: !memberColorClass,
            })}
        >
      {showLocationIconBelow && roomMember && (
    <OptionalTooltip
        tooltip={
            tooltip || coordinatesTitle ? (
                <div>
                    {tooltip}
                </div>
            ) : undefined
        }
    >
        <div className="mx_Marker_coordinates">
            <div className="mx_Marker_border mx_Marker_border_small">
                <MemberAvatar
                    member={roomMember}
                    size="24px"
                    viewUserOnClick={false}
                    hideTitle
                />
            </div>
        </div>
    </OptionalTooltip>
)}

        </div>
    );
});

export default Marker;
