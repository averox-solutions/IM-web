/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useContext, useMemo, useState } from "react";
import { type Room, JoinRule } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import { EffectiveMembership, getEffectiveMembership } from "../../../utils/membership";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { useRoomState } from "../../../hooks/useRoomState";
import { useMyRoomMembership } from "../../../hooks/useRoomMembers";
import AccessibleButton from "../elements/AccessibleButton";
import InlineSpinner from "../elements/InlineSpinner";
import RoomName from "../elements/RoomName";
import RoomTopic from "../elements/RoomTopic";
import RoomFacePile from "../elements/RoomFacePile";
import RoomAvatar from "../avatars/RoomAvatar";
import MemberAvatar from "../avatars/MemberAvatar";
import { BetaPill } from "../beta/BetaCard";
import RoomInfoLine from "./RoomInfoLine";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";

interface IProps {
    room: Room;
    onJoinButtonClicked: () => void;
    onRejectButtonClicked: () => void;
}

/* Shared black button style */
const blackBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    height: 36,
    padding: "0 14px",
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid #000",
    background: "#000",
    color: "#fff",
    cursor: "pointer",
};

const RoomPreviewCard: FC<IProps> = ({ room, onJoinButtonClicked, onRejectButtonClicked }) => {
    const cli = useContext(MatrixClientContext);
    const isVideoRoom = calcIsVideoRoom(room);
    const myMembership = useMyRoomMembership(room);

    const [busy, setBusy] = useState(false);
    const [autoRejected, setAutoRejected] = useState<null | { when: number; reason: string }>(null);

    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const cannotJoin =
        getEffectiveMembership(myMembership) === EffectiveMembership.Leave && joinRule !== JoinRule.Public;

    const viewLabs = (): void =>
        defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Labs,
        });

    // Heuristic matcher for the “no known servers in room” remote-join failure
    const looksLikeNoKnownServersError = useMemo(() => {
        return (payloadError: any): boolean => {
            const httpStatus =
                payloadError?.httpStatus ?? payloadError?.status ?? payloadError?.http_code ?? payloadError?.response?.status;
            const errcode = payloadError?.errcode ?? payloadError?.data?.errcode;
            const message = String(
                payloadError?.message ??
                    payloadError?.error ??
                    payloadError?.data?.error ??
                    payloadError?.response?.data?.error ??
                    "",
            ).toLowerCase();

            const phraseHit =
                message.includes("can't join remote room") &&
                message.includes("no servers") &&
                message.includes("have been provided");

            // The Matrix spec notes that when errcode = M_UNKNOWN, clients should lean on the HTTP status
            // to classify the error; the cases we care about surface as 404. We also key off the message phrase.
            return httpStatus === 404 && phraseHit && (!errcode || errcode === "M_UNKNOWN");
        };
    }, []);

    // Listen for Element’s join error and auto-reject this invite on the specific failure.
    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.JoinRoomError && payload.roomId === room.roomId) {
            const errLike = (payload as any).error ?? payload; // tolerate payload shapes
            if (looksLikeNoKnownServersError(errLike)) {
                // Automatically reject the invite
                setBusy(true);
                try {
                    onRejectButtonClicked();
                } finally {
                    setAutoRejected({
                        when: Date.now(),
                        reason:
                            _t("room|auto_rejected_no_known_servers") ||
                            "Invite auto-rejected: no known servers in room (remote join failed).",
                    });
                    setBusy(false);
                }
            } else {
                // On any other join error, just stop the spinner
                setBusy(false);
            }
        }
    });

    let inviterSection: JSX.Element | null = null;
    let joinButtons: JSX.Element;

    if (myMembership === KnownMembership.Join) {
        joinButtons = (
            <AccessibleButton
                onClick={() => {
                    defaultDispatcher.dispatch({
                        action: "leave_room",
                        room_id: room.roomId,
                    });
                }}
                style={blackBtn}
            >
                {_t("action|leave")}
            </AccessibleButton>
        );
    } else if (myMembership === KnownMembership.Invite) {
        const inviteSender = room.getMember(cli.getUserId()!)?.events.member?.getSender();
        if (inviteSender) {
            const inviter = room.getMember(inviteSender);
            inviterSection = (
                <div className="mx_RoomPreviewCard_inviter">
                    <MemberAvatar member={inviter} fallbackUserId={inviteSender} size="32px" />
                    <div>
                        <div className="mx_RoomPreviewCard_inviter_name">
                            {_t("room|invites_you_text", {}, { inviter: () => <strong>{inviter?.name || inviteSender}</strong> })}
                        </div>
                        {inviter ? <div className="mx_RoomPreviewCard_inviter_mxid">{inviteSender}</div> : null}
                    </div>
                </div>
            );
        }

        joinButtons = (
            <div style={{ display: "flex", gap: 8 }}>
                <AccessibleButton
                    onClick={() => {
                        setBusy(true);
                        onRejectButtonClicked();
                    }}
                    style={blackBtn}
                >
                    {_t("action|reject")}
                </AccessibleButton>
                <AccessibleButton
                    onClick={() => {
                        setBusy(true);
                        onJoinButtonClicked();
                    }}
                    style={blackBtn}
                >
                    {_t("action|accept")}
                </AccessibleButton>
            </div>
        );
    } else {
        joinButtons = (
            <AccessibleButton
                onClick={() => {
                    onJoinButtonClicked();
                    if (!cli.isGuest()) setBusy(true);
                }}
                disabled={cannotJoin}
                style={blackBtn}
            >
                {_t("action|join")}
            </AccessibleButton>
        );
    }

    if (busy) {
        joinButtons = <InlineSpinner />;
    }

    let avatarRow: JSX.Element;
    if (isVideoRoom) {
        avatarRow = (
            <>
                <RoomAvatar room={room} size="50px" viewAvatarOnClick />
                <div className="mx_RoomPreviewCard_video" />
                <BetaPill onClick={viewLabs} tooltipTitle={_t("labs|video_rooms_beta")} />
            </>
        );
    } else if (room.isSpaceRoom()) {
        avatarRow = <RoomAvatar room={room} size="80px" viewAvatarOnClick />;
    } else {
        avatarRow = <RoomAvatar room={room} size="50px" viewAvatarOnClick />;
    }

    return (
        <div className="mx_RoomPreviewCard">
            {inviterSection}
            <div className="mx_RoomPreviewCard_avatar">{avatarRow}</div>
            <h1 className="mx_RoomPreviewCard_name">
                <RoomName room={room} />
            </h1>
            <RoomInfoLine room={room} />
            <RoomTopic room={room} className="mx_RoomPreviewCard_topic" />
            {room.getJoinRule() === "public" && <RoomFacePile room={room} />}
            {cannotJoin && (
                <div className="mx_RoomPreviewCard_notice">
                    {_t("room|join_failed_needs_invite", { roomName: room.name })}
                </div>
            )}
            {autoRejected && (
                <div className="mx_RoomPreviewCard_notice" role="status" aria-live="polite" style={{ marginTop: 8 }}>
                    {autoRejected.reason}
                </div>
            )}
            <div className="mx_RoomPreviewCard_joinButtons" style={{ marginTop: 12 }}>
                {joinButtons}
            </div>
        </div>
    );
};

export default RoomPreviewCard;
