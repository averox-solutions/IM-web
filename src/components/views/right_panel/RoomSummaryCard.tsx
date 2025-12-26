/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, {
    type ChangeEvent,
    type SyntheticEvent,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import classNames from "classnames";
import {
    MenuItem,
    Separator,
    ToggleMenuItem,
    Text,
    Badge,
    Heading,
    IconButton,
    Link,
} from "@vector-im/compound-web";
import FavouriteIcon from "@vector-im/compound-design-tokens/assets/web/icons/favourite";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import ExportArchiveIcon from "@vector-im/compound-design-tokens/assets/web/icons/export-archive";
import LeaveIcon from "@vector-im/compound-design-tokens/assets/web/icons/leave";
import FilesIcon from "@vector-im/compound-design-tokens/assets/web/icons/files";
import UserProfileIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-profile";
import PollsIcon from "@vector-im/compound-design-tokens/assets/web/icons/polls";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-solid";
import LockOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-off";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { EventType, JoinRule, type Room, RoomStateEvent, M_POLL_START, M_POLL_END } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import Modal from "../../../Modal";
import { ShareDialog } from "../dialogs/ShareDialog";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import RoomName from "../elements/RoomName";
import ExportDialog from "../dialogs/ExportDialog";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import PosthogTrackers from "../../../PosthogTrackers";
import { PollHistoryDialog } from "../dialogs/PollHistoryDialog";
import { Flex } from "../../utils/Flex";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { tagRoom } from "../../../utils/room/tagRoom";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { inviteToRoom } from "../../../utils/room/inviteToRoom";
import { useAccountData } from "../../../hooks/useAccountData";
import { useRoomState } from "../../../hooks/useRoomState";
import { useTopic } from "../../../hooks/room/useTopic";
import { Linkify, topicToHtml } from "../../../HtmlUtils";
import { Box } from "../../utils/Box";
import { onRoomTopicLinkClick } from "../elements/RoomTopic";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { Action } from "../../../dispatcher/actions";
import { useTransition } from "../../../hooks/useTransition";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";
import { usePinnedEvents, useSortedFetchedPinnedEvents } from "../../../hooks/usePinnedEvents";
import { ReleaseAnnouncement } from "../../structures/ReleaseAnnouncement.tsx";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";
import RoomListActions from "../../../actions/RoomListActions";
import { bulkDeleteEventsForMe } from "../../../utils/room/deleteForMe";
import { DeletedEventsStore } from "../../../stores/DeletedEventsStore";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onSearchChange?: (e: ChangeEvent) => void;
    onSearchCancel?: () => void;
    focusRoomSearch?: boolean;
}

/* ---------------- topic block ---------------- */
const RoomTopic: React.FC<Pick<IProps, "room">> = ({ room }): JSX.Element | null => {
    const [expanded, setExpanded] = useState(true);
    const topic = useTopic(room);
    const body = topicToHtml(topic?.text, topic?.html);

    const canEditTopic = useRoomState(room, (state) =>
        state.maySendStateEvent(EventType.RoomTopic, room.client.getSafeUserId()),
    );

    const onEditClick = (e: SyntheticEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        defaultDispatcher.dispatch({ action: "open_room_settings" });
    };

    if (!body && !canEditTopic) return null;

    if (!body) {
        return (
            <Flex as="section" direction="column" justify="center" gap="var(--cpd-space-2x)">
                <Box flex="1">
                    <Link kind="primary" onClick={onEditClick}>
                        <Text size="sm">{_t("right_panel|add_topic")}</Text>
                    </Link>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex
            as="section"
            direction="column"
            className={classNames("mx_RoomSummaryCard_topic", {
                mx_RoomSummaryCard_topic_collapsed: !expanded,
            })}
        >
            <Box flex="1" className="mx_RoomSummaryCard_topic_container">
            <Text
    size="sm"
    className="mx_RoomSummaryCard_topic"
    onClick={(ev: React.MouseEvent): void => {
        if (ev.target instanceof HTMLAnchorElement) {
            onRoomTopicLinkClick(ev);
            return;
        }
    }}
>
    {/* Show the topic text (up to 37 characters) on the first line */}
    <Linkify>{body}</Linkify>
</Text>
                {/* <IconButton
                    className="mx_RoomSummaryCard_topic_chevron"
                    size="24px"
                    onClick={() => setExpanded(!expanded)}
                >
                    <ChevronDownIcon />
                </IconButton> */}
            </Box>
        </Flex>
    );
};

/* ---------------- main card ---------------- */
const RoomSummaryCard: React.FC<IProps> = ({ room, permalinkCreator }) => {
    const cli = useContext(MatrixClientContext);

    const onShareRoomClick = (): void => {
        Modal.createDialog(ShareDialog, { target: room });
    };

    const onRoomExportClick = (): void => {
        Modal.createDialog(ExportDialog, { room });
    };

    const onRoomPollHistoryClick = (): void => {
        Modal.createDialog(PollHistoryDialog, { room, matrixClient: cli, permalinkCreator });
    };

    const onLeaveRoomClick = async (): Promise<void> => {
        if (isDirectMessage) {
            // For 1‑1 chats, treat "leave" as applying the 1‑1 leave tag instead of actually leaving the room.
            // Mirrors the behaviour of the left-panel 1‑1 Leave Chat option.
            defaultDispatcher.dispatch(RoomListActions.tagRoom(cli, room, null, "m.leave-1-1-chat", 0));

            // Close right panel and, if we're currently viewing this DM, go back to home.
            RightPanelStore.instance.hide(null);
            RightPanelStore.instance.reset();
            if (SdkContextClass.instance.roomViewStore.getRoomId() === room.roomId) {
                defaultDispatcher.dispatch({ action: Action.ViewHomePage });
            }

            // Delete all messages for current user via custom API and hide them locally (excluding poll events).
            try {
                const events = room.getLiveTimeline().getEvents();
                // Filter out poll events - they should remain visible even when chat is "deleted"
                const nonPollEventIds = events
                    .filter((e) => {
                        const eventType = e.getType();
                        return !M_POLL_START.matches(eventType) && !M_POLL_END.matches(eventType);
                    })
                    .map((e) => e.getId())
                    .filter((id): id is string => !!id);
                
                const ok = nonPollEventIds.length > 0
                    ? await bulkDeleteEventsForMe(cli, room.roomId, { event_ids: nonPollEventIds })
                    : true; // No events to delete
                
                if (ok) {
                    // Mark only non-poll events as deleted
                    DeletedEventsStore.getInstance().setDeletedForRoom(room.roomId, nonPollEventIds);
                }
            } catch (e) {
                console.error(
                    `Failed to bulk delete events for room ${room.roomId} after applying leave tag from RoomSummaryCard:`,
                    e,
                );
            }

            return;
        }

        // Non‑DM: keep existing "leave room" behaviour.
        defaultDispatcher.dispatch({
            action: (Action as any)?.LeaveRoom ?? "leave_room",
            room_id: room.roomId,
          });
    };

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const roomContext = useScopedRoomContext("e2eStatus");
    const e2eStatus = roomContext.e2eStatus;
    const isVideoRoom = calcIsVideoRoom(room);

    const roomState = useRoomState(room);
    const directRoomsList = useAccountData<Record<string, string[]>>(room.client, EventType.Direct);
    const [isDirectMessage, setDirectMessage] = useState(false);

    useEffect(() => {
        for (const [, dmRoomList] of Object.entries(directRoomsList)) {
            if (dmRoomList.includes(room?.roomId ?? "")) {
                setDirectMessage(true);
                break;
            }
        }
    }, [room, directRoomsList]);

    const alias = room.getCanonicalAlias() || room.getAltAliases()[0] || "";
    const pinnedEventIds = usePinnedEvents(room);
    const pinnedEvents = useSortedFetchedPinnedEvents(room, pinnedEventIds);
    const [deletedEventsStore, setDeletedEventsStore] = useState(DeletedEventsStore.getInstance());

    // Load deleted events for this room and subscribe to changes
    useEffect(() => {
        if (!cli) return;
        const store = DeletedEventsStore.getInstance();
        store.loadRoom(cli, room.roomId).catch((e) => {
            // Error already logged in store
        });
        const unsubscribe = store.addRoomListener(room.roomId, () => {
            setDeletedEventsStore(DeletedEventsStore.getInstance());
        });
        return unsubscribe;
    }, [cli, room.roomId]);

    // Filter out deleted events and count visible ones
    const visiblePinnedCount = pinnedEvents
        ? pinnedEvents.filter((event) => {
              if (!event) return false;
              const eventId = event.getId();
              const roomId = event.getRoomId();
              return !eventId || !deletedEventsStore.isDeleted(roomId, eventId);
          }).length
        : pinnedEventIds.length; // While loading, show the full count

    const pinCount = visiblePinnedCount;
    const roomTags = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () =>
        RoomListStore.instance.getTagsForRoom(room),
    );
    const canInviteToState = useEventEmitterState(room, RoomStateEvent.Update, () => canInviteTo(room));
    const isFavorite = roomTags.includes(DefaultTagID.Favourite);

    /* --- show map --- */
    const SHOW = isDirectMessage
        ? {
              favourite: true,
              invite: false,
              people: false,
              pinned: true,
              files: true,
              copyLink: false,
              polls: false,
              exportChat: false,
              settings: false,
              topic: false,
          }
        : {
              favourite: true,
              invite: true,
              people: true,
              pinned: !isVideoRoom,
              files: !isVideoRoom,
              copyLink: true,
              polls: !isVideoRoom,
              exportChat: !isVideoRoom,
              settings: true,
              topic: true,
          };

    /* --- header info --- */
    const roomInfo = (
        <header className="mx_RoomSummaryCard_container">
            <RoomAvatar room={room} size="80px" viewAvatarOnClick />
            <RoomName room={room}>
                {(name) => (
                    <Heading as="h1" size="md" className="mx_RoomSummaryCard_roomName" title={name}>
                        {name}

                    </Heading>
                )}
            </RoomName>
            <Text as="div" size="sm" className="mx_RoomSummaryCard_alias" title={alias}>
                {alias}
            </Text>

            <Flex as="section" justify="center" gap="var(--cpd-space-2x)">
                {isRoomEncrypted && e2eStatus !== E2EStatus.Warning && (
                    <Badge kind="green">
                        <LockIcon width="1em" /> {_t("common|encrypted")}
                    </Badge>
                )}
                {!e2eStatus && (
                    <Badge kind="grey">
                        <LockOffIcon width="1em" /> {_t("common|unencrypted")}
                    </Badge>
                )}
            </Flex>

            {SHOW.topic && <RoomTopic room={room} />}
        </header>
    );

    /* --- menu items --- */
    return (
        <BaseCard id="room-summary-panel" className="mx_RoomSummaryCard" onClose={() => RightPanelStore.instance.togglePanel(room.roomId)}>
            {roomInfo}
            <Separator />
            <div role="menubar" aria-orientation="vertical">
                {SHOW.favourite && (
                    <ToggleMenuItem
                        Icon={FavouriteIcon}
                        label={_t("room|context_menu|favourite")}
                        checked={isFavorite}
                        onSelect={() => tagRoom(room, DefaultTagID.Favourite)}
                    />
                )}

                {SHOW.invite && (
                    <MenuItem
                        Icon={UserAddIcon}
                        label={_t("action|invite")}
                        disabled={!canInviteToState}
                        onSelect={() => inviteToRoom(room)}
                    />
                )}

                {SHOW.people && (
                    <MenuItem
                        Icon={UserProfileIcon}
                        label={_t("common|people")}
                        onSelect={() =>
                            RightPanelStore.instance.pushCard({ phase: RightPanelPhases.MemberList }, true)
                        }
                    />
                )}

                {SHOW.pinned && (
                    <ReleaseAnnouncement
                        feature="pinningMessageList"
                        header={_t("right_panel|pinned_messages|release_announcement|title")}
                        description={_t("right_panel|pinned_messages|release_announcement|description")}
                        closeLabel={_t("right_panel|pinned_messages|release_announcement|close")}
                        placement="top"
                    >
                        <div>
                            <MenuItem
                                Icon={PinIcon}
                                label={_t("right_panel|pinned_messages_button")}
                                onSelect={() =>
                                    RightPanelStore.instance.pushCard({ phase: RightPanelPhases.PinnedMessages }, true)
                                }
                            >
                                <Text as="span" size="sm">
                                    {pinCount}
                                </Text>
                            </MenuItem>
                        </div>
                    </ReleaseAnnouncement>
                )}

                {SHOW.files && (
                    <MenuItem
                        Icon={FilesIcon}
                        label={_t("right_panel|files_button")}
                        onSelect={() =>
                            RightPanelStore.instance.pushCard({ phase: RightPanelPhases.FilePanel }, true)
                        }
                    />
                )}

                {SHOW.copyLink && (
                    <MenuItem Icon={LinkIcon} label={_t("action|copy_link")} onSelect={onShareRoomClick} />
                )}

                {SHOW.polls && (
                    <MenuItem Icon={PollsIcon} label={_t("right_panel|polls_button")} onSelect={onRoomPollHistoryClick} />
                )}

                {SHOW.exportChat && (
                    <MenuItem Icon={ExportArchiveIcon} label={_t("export_chat|title")} onSelect={onRoomExportClick} />
                )}

                {SHOW.settings && (
                    <MenuItem Icon={SettingsIcon} label={_t("common|settings")} onSelect={() => defaultDispatcher.dispatch({ action: "open_room_settings" })} />
                )}

                <Separator />

                <MenuItem
                    Icon={LeaveIcon}
                    kind="critical"
                    label={
                        isDirectMessage ? _t("room|context_menu|leave_1_1_chat") : _t("action|leave_room")
                    }
                    onSelect={onLeaveRoomClick}
                />
            </div>
        </BaseCard>
    );
};

export default RoomSummaryCard;
