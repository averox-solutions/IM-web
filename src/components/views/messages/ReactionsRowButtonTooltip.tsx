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

// Base URL for backend services (e.g., notifications), configurable via env
// Primary: REACT_APP_NOTIFCATIONURL (as requested), Fallbacks: REACT_APP_BACKEND_URL, localhost
const NOTIFICATION_API_BASE_URL =
    process.env.REACT_APP_NOTIFCATIONURL ||  "http://localhost:4000";

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
    private static sentKeys: Set<string> = new Set();
    private static readonly STORAGE_KEY = "mx_reaction_notified_keys";
    private static loadSentKeys(): void {
        try {
            const raw = localStorage.getItem(ReactionsRowButtonTooltip.STORAGE_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    ReactionsRowButtonTooltip.sentKeys = new Set(arr);
                }
            }
        } catch {
            // ignore
        }
    }
    private static persistSentKeys(): void {
        try {
            localStorage.setItem(
                ReactionsRowButtonTooltip.STORAGE_KEY,
                JSON.stringify(Array.from(ReactionsRowButtonTooltip.sentKeys)),
            );
        } catch {
            // ignore
        }
    }

    private getNotificationKey(): string {
        const { content, mxEvent } = this.props;
        const eventId = mxEvent.getId?.() || "";
        return `${eventId}::${content}`;
    }

    private triggerNotifications = (): void => {
        const key = this.getNotificationKey();
        if (ReactionsRowButtonTooltip.sentKeys.has(key)) return;

        try {
            const mxUserId = localStorage.getItem("mx_user_id") || "";
            let formattedUsername = mxUserId;
            if (formattedUsername.startsWith("@")) {
                formattedUsername = formattedUsername.slice(1);
            }
            formattedUsername = formattedUsername.replace(/:ms\.beep\.gov\.pk$/, "");

            // Attempt to read activeCallData from localStorage for recipients
            let recipients: string[] | undefined;
            try {
                const raw = localStorage.getItem("activeCallData");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed?.toUserIds)) {
                        recipients = parsed.toUserIds as string[];
                    }
                }
            } catch {
                // ignore parse errors
            }

            const send = (targetUserId: string): void => {
                let cleaned = targetUserId || "";
                if (cleaned.startsWith("@")) cleaned = cleaned.slice(1);
                cleaned = cleaned.replace(/:ms\.beep\.gov\.pk$/, "");
                void fetch(`${NOTIFICATION_API_BASE_URL}/send-notification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: targetUserId,
                        notificationTitle: formattedUsername,
                        notificationBody: "Reacted",
                    }),
                });
            };

            if (recipients && recipients.length > 0) {
                for (const r of recipients) {
                    send(r);
                }
            } else {
                // Fallback: send to current username if no recipients available
                send(mxUserId);
            }

            ReactionsRowButtonTooltip.sentKeys.add(key);
            ReactionsRowButtonTooltip.persistSentKeys();
        } catch (e) {
            // ignore
        }
    };

    public componentDidMount(): void {
        ReactionsRowButtonTooltip.loadSentKeys();
        this.triggerNotifications();
    }

    public componentDidUpdate(prevProps: Readonly<PropsWithChildren<IProps>>): void {
        if (prevProps.mxEvent !== this.props.mxEvent || prevProps.content !== this.props.content) {
            this.triggerNotifications();
        }
    }

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
            ? _t("timeline|reactions|tooltip_caption", { shortName: String(shortName) })
            : undefined;
        console.log(formattedSenders, caption, shortName);

        return (
            <Tooltip description={formattedSenders} caption={caption} placement="right">
                {children}
            </Tooltip>
        );
    }
}
