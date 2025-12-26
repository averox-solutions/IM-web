/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { EventType, type MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";

import { mediaFromMxc } from "../../../customisations/Media";
import { _t } from "../../../languageHandler";
import { formatList } from "../../../utils/FormattingUtils";
import dis from "../../../dispatcher/dispatcher";
import ReactionsRowButtonTooltip from "./ReactionsRowButtonTooltip";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";
import DMRoomMap from "../../../utils/DMRoomMap";

export interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The reaction content / key / emoji
    content: string;
    // The count of votes for this key
    count: number;
    // A list of Matrix reaction events for this key
    reactionEvents: MatrixEvent[];
    // A possible Matrix event if the current user has voted for this type
    myReactionEvent?: MatrixEvent;
    // Whether to prevent quick-reactions by clicking on this reaction
    disabled?: boolean;
    // Whether to render custom image reactions
    customReactionImagesEnabled?: boolean;
}

export default class ReactionsRowButton extends React.PureComponent<IProps> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public onClick = (): void => {
        const { mxEvent, myReactionEvent, content } = this.props;
        const roomId = mxEvent.getRoomId()!;
        const cli = this.context;
        
        if (myReactionEvent) {
            this.context.redactEvent(roomId, myReactionEvent.getId()!);
        } else {
            // Check if this is a 1-1 DM
            const isDM = !!DMRoomMap.shared().getUserIdForRoomId(roomId);
            
            // If it's a DM, check if user already has a different reaction and remove it
            if (isDM) {
                const room = cli.getRoom(roomId);
                if (room) {
                    const messageReactions = room.relations.getChildEventsForEvent(
                        mxEvent.getId()!,
                        RelationType.Annotation,
                        EventType.Reaction,
                    );
                    
                    if (messageReactions) {
                        const userId = cli.getSafeUserId();
                        const myReactionEvents = messageReactions.getAnnotationsBySender()?.[userId] || new Set<MatrixEvent>();
                        
                        // Find any existing reaction that's different from the one being added
                        for (const reactionEvent of myReactionEvents) {
                            if (!reactionEvent.isRedacted()) {
                                const reactionKey = reactionEvent.getRelation()?.key;
                                // If it's a different reaction, remove it
                                if (reactionKey && reactionKey !== content) {
                                    cli.redactEvent(roomId, reactionEvent.getId()!);
                                    break; // Only remove one (user can only have one in DMs)
                                }
                            }
                        }
                    }
                }
            }
            
            this.context.sendEvent(roomId, EventType.Reaction, {
                "m.relates_to": {
                    rel_type: RelationType.Annotation,
                    event_id: mxEvent.getId()!,
                    key: content,
                },
            });
            dis.dispatch({ action: "message_sent" });
        }
    };

    public render(): React.ReactNode {
        const { mxEvent, content, count, reactionEvents, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: !!myReactionEvent,
        });

        const room = this.context.getRoom(mxEvent.getRoomId());
        let label: string | undefined;
        let customReactionName: string | undefined;
        if (room) {
            const senders: string[] = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                senders.push(member?.name || reactionEvent.getSender()!);
                customReactionName =
                    (this.props.customReactionImagesEnabled &&
                        REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }

            const reactors = formatList(senders, 6);
            if (content) {
                label = _t("timeline|reactions|label", {
                    reactors,
                    content: customReactionName || content,
                });
            } else {
                label = reactors;
            }
        }

        let reactionContent = (
            <span className="mx_ReactionsRowButton_content" aria-hidden="true">
                {content}
            </span>
        );
        if (this.props.customReactionImagesEnabled && content.startsWith("mxc://")) {
            const imageSrc = mediaFromMxc(content).srcHttp;
            if (imageSrc) {
                reactionContent = (
                    <img
                        className="mx_ReactionsRowButton_content"
                        alt={customReactionName || _t("timeline|reactions|custom_reaction_fallback_label")}
                        src={imageSrc}
                        width="16"
                        height="16"
                    />
                );
            }
        }

        return (
            <ReactionsRowButtonTooltip
                mxEvent={this.props.mxEvent}
                content={content}
                reactionEvents={reactionEvents}
                customReactionImagesEnabled={this.props.customReactionImagesEnabled}
            >
                <AccessibleButton
                    className={classes}
                    aria-label={label}
                    onClick={this.onClick}
                    disabled={this.props.disabled}
                >
                    {reactionContent}
                    <span className="mx_ReactionsRowButton_count" aria-hidden="true">
                        {count}
                    </span>
                </AccessibleButton>
            </ReactionsRowButtonTooltip>
        );
    }
}
