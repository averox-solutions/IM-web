/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import React, { useContext, useMemo, useState, useCallback, useEffect } from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import RoomListActions from "../../../actions/RoomListActions";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import dis from "../../../dispatcher/dispatcher";
import { useEventEmitterState, useEventEmitter } from "../../../hooks/useEventEmitter";
import { useUnreadNotifications } from "../../../hooks/useUnreadNotifications";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { DefaultTagID, type TagID } from "../../../stores/room-list/models";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import DMRoomMap from "../../../utils/DMRoomMap";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { getOtherUserTagStatus, type TagStatusResponse } from "../../../utils/room/getOtherUserTagStatus";
import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { type ButtonEvent } from "../elements/AccessibleButton";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { DeveloperToolsOption } from "./DeveloperToolsOption";
import { useSettingValue } from "../../../hooks/useSettings";
import UIStore from "../../../stores/UIStore";

export interface RoomGeneralContextMenuProps extends IContextMenuProps {
    room: Room;
    /**
     * Called when the 'favourite' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostFavoriteClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'low priority' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostLowPriorityClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'invite' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostInviteClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'copy link' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostCopyLinkClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'settings' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostSettingsClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'forget room' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostForgetClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'leave' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostLeaveClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'mark as read' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostMarkAsReadClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'mark as unread' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostMarkAsUnreadClick?: (event: ButtonEvent) => void;
}

/**
 * Room context menu accessible via the room list.
 */
export const RoomGeneralContextMenu: React.FC<RoomGeneralContextMenuProps> = ({
    room,
    onFinished,
    onPostFavoriteClick,
    onPostLowPriorityClick,
    onPostInviteClick,
    onPostCopyLinkClick,
    onPostSettingsClick,
    onPostLeaveClick,
    onPostForgetClick,
    onPostMarkAsReadClick,
    onPostMarkAsUnreadClick,
    ...props
}) => {
    const cli = useContext(MatrixClientContext);
    const roomTags = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () =>
        RoomListStore.instance.getTagsForRoom(room),
    );
    const isDm = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    
    // State for other user's tag status
    const [otherUserTagStatus, setOtherUserTagStatus] = useState<TagStatusResponse | null>(null);
    const [isLoadingOtherUserTags, setIsLoadingOtherUserTags] = useState(false);
    
    // Fetch other user's tag status when menu opens for a 1-1 chat
    useEffect(() => {
        if (isDm && cli) {
            setIsLoadingOtherUserTags(true);
            getOtherUserTagStatus(cli, room)
                .then((status) => {
                    setOtherUserTagStatus(status);
                    if (status) {
                        logger.log("Other user's tag status:", status);
                    }
                })
                .catch((error) => {
                    logger.error("Failed to fetch other user's tag status:", error);
                })
                .finally(() => {
                    setIsLoadingOtherUserTags(false);
                });
        }
    }, [isDm, cli, room]);
    
    // Create a state that updates when room tags change
    const [tagsUpdateTrigger, setTagsUpdateTrigger] = useState(0);
    const onRoomTagsUpdate = useCallback(() => {
        // Force a re-render by updating the trigger
        setTagsUpdateTrigger((prev) => prev + 1);
    }, []);
    
    // Listen to room tag changes to trigger re-render
    // Tags are stored as account data, so we listen to both Tags and AccountData events
    useEventEmitter(room, RoomEvent.Tags, onRoomTagsUpdate);
    useEventEmitter(room, RoomEvent.AccountData, onRoomTagsUpdate);
    
    // Check room.tags directly for the actual Matrix tag name - update when tags change
    const hasLeaveTag = useMemo(() => !!(room.tags && room.tags["m.leave-1-1-chat"]), [room.tags, tagsUpdateTrigger]);
    const wrapHandler = (
        handler: (ev: ButtonEvent) => void,
        postHandler?: (ev: ButtonEvent) => void,
        persistent = false,
    ): ((ev: ButtonEvent) => void) => {
        return (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            handler(ev);

            const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);
            if (!persistent || action === KeyBindingAction.Enter) {
                onFinished();
            }
            postHandler?.(ev);
        };
    };

    const onTagRoom = (ev: ButtonEvent, tagId: TagID): void => {
        if (!cli) return;
        if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
            const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
            const isApplied = RoomListStore.instance.getTagsForRoom(room).includes(tagId);
            const removeTag = isApplied ? tagId : inverseTag;
            const addTag = isApplied ? null : tagId;
            
            // Also remove leave tag if it exists (mutually exclusive)
            const hasLeaveTag = !!(room.tags && room.tags["m.leave-1-1-chat"]);
            if (hasLeaveTag && !isApplied) {
                // Remove leave tag first, then add the new tag
                cli.deleteRoomTag(room.roomId, "m.leave-1-1-chat")
                    .then(() => {
                        dis.dispatch(RoomListActions.tagRoom(cli, room, removeTag, addTag, 0));
                    })
                    .catch((err) => {
                        logger.error("Failed to remove leave tag: " + err);
                        // Still proceed with adding the new tag
                        dis.dispatch(RoomListActions.tagRoom(cli, room, removeTag, addTag, 0));
                    });
            } else {
                dis.dispatch(RoomListActions.tagRoom(cli, room, removeTag, addTag, 0));
            }
        } else if (tagId === "m.leave-1-1-chat") {
            // Check room.tags directly for the actual Matrix tag name
            const isApplied = !!(room.tags && room.tags["m.leave-1-1-chat"]);
            
            if (isApplied) {
                // Just remove the leave tag
                dis.dispatch(RoomListActions.tagRoom(cli, room, "m.leave-1-1-chat", null, 0));
            } else {
                // Remove favourite and low priority tags first (mutually exclusive)
                const hasFavourite = !!(room.tags && room.tags[DefaultTagID.Favourite]);
                const hasLowPriority = !!(room.tags && room.tags[DefaultTagID.LowPriority]);
                
                const promises: Promise<any>[] = [];
                
                if (hasFavourite) {
                    promises.push(cli.deleteRoomTag(room.roomId, DefaultTagID.Favourite).catch((err) => {
                        logger.error("Failed to remove favourite tag: " + err);
                    }));
                }
                
                if (hasLowPriority) {
                    promises.push(cli.deleteRoomTag(room.roomId, DefaultTagID.LowPriority).catch((err) => {
                        logger.error("Failed to remove low priority tag: " + err);
                    }));
                }
                
                // Wait for other tags to be removed, then add leave tag
                if (promises.length > 0) {
                    Promise.all(promises).then(() => {
                        dis.dispatch(RoomListActions.tagRoom(cli, room, null, "m.leave-1-1-chat", 0));
                    }).catch((err) => {
                        logger.error("Failed to remove conflicting tags: " + err);
                        // Still try to add the leave tag even if removal failed
                        dis.dispatch(RoomListActions.tagRoom(cli, room, null, "m.leave-1-1-chat", 0));
                    });
                } else {
                    // No conflicting tags, just add the leave tag
                    dis.dispatch(RoomListActions.tagRoom(cli, room, null, "m.leave-1-1-chat", 0));
                }
            }
        } else {
            logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
        }
    };

    const isFavorite = roomTags.includes(DefaultTagID.Favourite);
    const favoriteOption: React.ReactElement = (
        <IconizedContextMenuCheckbox
            onClick={wrapHandler((ev) => onTagRoom(ev, DefaultTagID.Favourite), onPostFavoriteClick, true)}
            active={isFavorite}
            label={isFavorite ? _t("room|context_menu|unfavourite") : _t("room|context_menu|favourite")}
            iconClassName="mx_RoomGeneralContextMenu_iconStar"
        />
    );

    const isLowPriority = roomTags.includes(DefaultTagID.LowPriority);
    const lowPriorityOption: React.ReactElement = (
        <IconizedContextMenuCheckbox
            onClick={wrapHandler((ev) => onTagRoom(ev, DefaultTagID.LowPriority), onPostLowPriorityClick, true)}
            active={isLowPriority}
            label={_t("room|context_menu|low_priority")}
            iconClassName="mx_RoomGeneralContextMenu_iconArrowDown"
        />
    );

    // Only show leave 1-1 chat option for direct messages
    const leaveOneOnOneChatOption: React.ReactElement | null = isDm ? (
        <IconizedContextMenuCheckbox
            onClick={wrapHandler((ev) => onTagRoom(ev, "m.leave-1-1-chat"), undefined, true)}
            active={hasLeaveTag}
            label={_t("room|context_menu|leave_1_1_chat")}
            iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
        />
    ) : null;

    let inviteOption: React.ReactElement | null = null;
    if (room.canInvite(cli.getUserId()!) && !isDm && shouldShowComponent(UIComponent.InviteUsers)) {
        inviteOption = (
            <IconizedContextMenuOption
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "view_invite",
                            roomId: room.roomId,
                        }),
                    onPostInviteClick,
                )}
                label={_t("action|invite")}
                iconClassName="mx_RoomGeneralContextMenu_iconInvite"
            />
        );
    }

    // let copyLinkOption: JSX.Element | null = null;
    // if (!isDm) {
    //     copyLinkOption = (
    //         <IconizedContextMenuOption
    //             onClick={wrapHandler(
    //                 () =>
    //                     dis.dispatch({
    //                         action: "copy_room",
    //                         room_id: room.roomId,
    //                     }),
    //                 onPostCopyLinkClick,
    //             )}
    //             label={_t("room|context_menu|copy_link")}
    //             iconClassName="mx_RoomGeneralContextMenu_iconCopyLink"
    //         />
    //     );
    // }


    let leaveOption: React.ReactElement;
    if (roomTags.includes(DefaultTagID.Archived)) {
        leaveOption = (
            <IconizedContextMenuOption
                iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
                label={_t("room|context_menu|forget")}
                className="mx_IconizedContextMenu_option_red"
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "forget_room",
                            room_id: room.roomId,
                        }),
                    onPostForgetClick,
                )}
            />
        );
    } else {
        leaveOption = (
            <IconizedContextMenuOption
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "leave_room",
                            room_id: room.roomId,
                        }),
                    onPostLeaveClick,
                )}
                label={_t("action|leave")}
                className="mx_IconizedContextMenu_option_red"
                iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
            />
        );
    }

    const { level } = useUnreadNotifications(room);
    const markAsReadOption: React.ReactElement | null = (() => {
        if (level > NotificationLevel.None) {
            return (
                <IconizedContextMenuOption
                    onClick={wrapHandler(() => {
                        clearRoomNotification(room, cli);
                        onFinished?.();
                    }, onPostMarkAsReadClick)}
                    label={_t("room|context_menu|mark_read")}
                    iconClassName="mx_RoomGeneralContextMenu_iconMarkAsRead"
                />
            );
        } else if (!roomTags.includes(DefaultTagID.Archived)) {
            return (
                <IconizedContextMenuOption
                    onClick={wrapHandler(() => {
                        setMarkedUnreadState(room, cli, true);
                        onFinished?.();
                    }, onPostMarkAsUnreadClick)}
                    label={_t("room|context_menu|mark_unread")}
                    iconClassName="mx_RoomGeneralContextMenu_iconMarkAsUnread"
                />
            );
        } else {
            return null;
        }
    })();

    const developerModeEnabled = useSettingValue("developerMode");
    // Hide developer tools on mobile/responsive mode (max-width: 767px)
    const isMobile = UIStore.instance.windowWidth <= 767;
    const developerToolsOption = developerModeEnabled && !isMobile ? (
        <DeveloperToolsOption onFinished={onFinished} roomId={room.roomId} />
    ) : null;

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_RoomGeneralContextMenu" compact>
            <IconizedContextMenuOptionList>
                {markAsReadOption}
                {!roomTags.includes(DefaultTagID.Archived) && (
                    <>
                        {favoriteOption}
                        {lowPriorityOption}
                        {inviteOption}
                        {leaveOneOnOneChatOption}
                        {/* {copyLinkOption} */}
                        {/* {settingsOption} */}
                    </>
                )}
                {developerToolsOption}
            </IconizedContextMenuOptionList>
            <IconizedContextMenuOptionList red>{leaveOption}</IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};
