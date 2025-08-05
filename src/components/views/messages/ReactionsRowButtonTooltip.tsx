/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type PropsWithChildren } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";

import { unicodeToShortcode } from "../../../HtmlUtils";
import { _t } from "../../../languageHandler";
import { formatList } from "../../../utils/FormattingUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";

interface IProps {
    /** The event we're displaying reactions for */
    mxEvent: MatrixEvent;
    /** The reaction content / key / emoji */
    content: string;
    /** A list of Matrix reaction events for this key */
    reactionEvents: MatrixEvent[];
    /** Whether to render custom image reactions */
    customReactionImagesEnabled?: boolean;
}

/**
 * Displays a tooltip for a reaction button, showing:
 * - The list of users who reacted with this emoji
 * - An optional caption (emoji shortcode)
 */
export default class ReactionsRowButtonTooltip extends React.PureComponent<PropsWithChildren<IProps>> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public render(): React.ReactNode {
        const { content, reactionEvents, mxEvent, children, customReactionImagesEnabled } = this.props;
        const room = this.context.getRoom(mxEvent.getRoomId());

        if (!room) {
            // If no room found, just render the children without tooltip
            
            return children;
        }

        // Collect the display names of users who reacted
        const senders: string[] = reactionEvents.map((reactionEvent) => {
            const senderId = reactionEvent.getSender()!;
            const member = room.getMember(senderId);
            return member?.name ?? senderId;
        });

        // Determine the custom reaction shortcode (if enabled)
        const customReactionName = customReactionImagesEnabled
            ? reactionEvents
                  .map((event) => REACTION_SHORTCODE_KEY.findIn(event.getContent()))
                  .filter(Boolean)[0] // take first found
            : undefined;

        // Convert emoji to shortcode (or use custom one)
        const shortName = unicodeToShortcode(content) || customReactionName;

        // Format the list of senders (limit to 6, add "and X more" if needed)
        const formattedSenders = formatList(senders, 6);

        // Optional caption under tooltip (emoji shortcode)
        const caption = shortName
            ? _t("timeline|reactions|tooltip_caption", { shortName })
            : undefined;

        return (
            <Tooltip description={formattedSenders} caption={caption} placement="right">
                {children}
            </Tooltip>
        );
    }
}
