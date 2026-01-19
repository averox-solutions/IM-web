/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type ReactNode } from "react";
import classNames from "classnames";
import {
    type IEventRelation,
    type MatrixEvent,
    type Room,
    type RoomMember,
    EventType,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";
import { Tooltip } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";
import { fetchUserTokenAndPlatform } from "../../../utils/userdetails";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
import Stickerpicker from "./Stickerpicker";
import { makeRoomPermalink, type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import E2EIcon from "./E2EIcon";
import SettingsStore from "../../../settings/SettingsStore";
import { aboveLeftOf, type MenuProps } from "../../structures/ContextMenu";
import ReplyPreview from "./ReplyPreview";
import { UserIdentityWarning } from "./UserIdentityWarning";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import VoiceRecordComposerTile from "./VoiceRecordComposerTile";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { RecordingState } from "../../../audio/VoiceRecording";
import type ResizeNotifier from "../../../utils/ResizeNotifier";
import { type E2EStatus } from "../../../utils/ShieldUtils";
import SendMessageComposer, { type SendMessageComposer as SendMessageComposerClass } from "./SendMessageComposer";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import type EditorModel from "../../../editor/model";
import UIStore, { UI_EVENTS } from "../../../stores/UIStore";
import RoomContext from "../../../contexts/RoomContext";
import { type SettingUpdatedPayload } from "../../../dispatcher/payloads/SettingUpdatedPayload";
import MessageComposerButtons from "./MessageComposerButtons";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";
import { type VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";
import { SendWysiwygComposer, sendMessage, getConversionFunctions } from "./wysiwyg_composer/";
import { type MatrixClientProps, withMatrixClientHOC } from "../../../contexts/MatrixClientContext";
import { UIFeature } from "../../../settings/UIFeature";
import { formatTimeLeft } from "../../../DateUtils";
import RoomReplacedSvg from "../../../../res/img/room_replaced.svg";
import DMRoomMap from "../../../utils/DMRoomMap";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { leaveRoomBehaviour } from "../../../utils/leave-behaviour";
import { Action as DispatcherAction } from "../../../dispatcher/actions";
import { type AfterLeaveRoomPayload } from "../../../dispatcher/payloads/AfterLeaveRoomPayload";
import { RoomStateEvent, RoomEvent } from "matrix-js-sdk/src/matrix";
import { setDMRoom } from "../../../Rooms";

// Base URL for backend services (e.g., notifications), configurable via env
// Primary: REACT_APP_NOTIFCATIONURL (as requested), Fallbacks: REACT_APP_BACKEND_URL, localhost
const NOTIFICATION_API_BASE_URL =
    process.env.REACT_APP_NOTIFCATIONURL || "http://localhost:4000";

// The prefix used when persisting editor drafts to localstorage.
export const WYSIWYG_EDITOR_STATE_STORAGE_PREFIX = "mx_wysiwyg_state_";

let instanceCount = 0;

interface ISendButtonProps {
    onClick: (ev: ButtonEvent) => void;
    title?: string; // defaults to something generic
}

function SendButton(props: ISendButtonProps): JSX.Element {
    return (
        <AccessibleButton
            className="mx_MessageComposer_sendMessage"
            onClick={props.onClick}
            title={props.title ?? _t("composer|send_button_title")}
            data-testid="sendmessagebtn"
        />
    );
}

interface IProps extends MatrixClientProps {
    room: Room;
    resizeNotifier: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
    relation?: IEventRelation;
    e2eStatus?: E2EStatus;
    compact?: boolean;
}

interface IState {
    composerContent: string;
    isComposerEmpty: boolean;
    haveRecording: boolean;
    recordingTimeLeftSeconds?: number;
    me?: RoomMember;
    isMenuOpen: boolean;
    isStickerPickerOpen: boolean;
    showStickersButton: boolean;
    showPollsButton: boolean;
    isWysiwygLabEnabled: boolean;
    isRichTextEnabled: boolean;
    initialComposerContent: string;
    shouldShowReopenButtons: boolean;
    otherUserId?: string;
}

type WysiwygComposerState = {
    content: string;
    isRichText: boolean;
    replyEventId?: string;
};

export class MessageComposer extends React.Component<IProps, IState> {
    private dispatcherRef?: string;
    private messageComposerInput = createRef<SendMessageComposerClass>();
    private voiceRecordingButton = createRef<VoiceRecordComposerTile>();
    private ref: React.RefObject<HTMLDivElement> = createRef();
    private instanceId: number;

    private _voiceRecording: Optional<VoiceMessageRecording>;

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public static defaultProps = {
        compact: false,
        isRichTextEnabled: true,
    };

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);
        this.context = context; // otherwise React will only set it prior to render due to type def above

        const isWysiwygLabEnabled = SettingsStore.getValue("feature_wysiwyg_composer");
        let isRichTextEnabled = true;
        let initialComposerContent = "";
        if (isWysiwygLabEnabled) {
            const wysiwygState = this.restoreWysiwygEditorState();
            if (wysiwygState) {
                isRichTextEnabled = wysiwygState.isRichText;
                initialComposerContent = wysiwygState.content;
            }
        }

        this.state = {
            isComposerEmpty: initialComposerContent?.length === 0,
            composerContent: initialComposerContent,
            haveRecording: false,
            recordingTimeLeftSeconds: undefined, // when set to a number, shows a toast
            isMenuOpen: false,
            isStickerPickerOpen: false,
            showStickersButton: SettingsStore.getValue("MessageComposerInput.showStickersButton"),
            showPollsButton: SettingsStore.getValue("MessageComposerInput.showPollsButton"),
            isWysiwygLabEnabled: isWysiwygLabEnabled,
            isRichTextEnabled: isRichTextEnabled,
            initialComposerContent: initialComposerContent,
            shouldShowReopenButtons: false,
            otherUserId: undefined,
        };

        this.instanceId = instanceCount++;
    }

    private get editorStateKey(): string {
        let key = WYSIWYG_EDITOR_STATE_STORAGE_PREFIX + this.props.room.roomId;
        if (this.props.relation?.rel_type === THREAD_RELATION_TYPE.name) {
            key += `_${this.props.relation.event_id}`;
        }
        return key;
    }

    private restoreWysiwygEditorState(): WysiwygComposerState | undefined {
        const json = localStorage.getItem(this.editorStateKey);
        if (json) {
            try {
                const state: WysiwygComposerState = JSON.parse(json);
                return state;
            } catch (e) {
                logger.error(e);
            }
        }
        return undefined;
    }

    private saveWysiwygEditorState = (): void => {
        if (this.shouldSaveWysiwygEditorState()) {
            const { isRichTextEnabled, composerContent } = this.state;
            const replyEventId = this.props.replyToEvent ? this.props.replyToEvent.getId() : undefined;
            const item: WysiwygComposerState = {
                content: composerContent,
                isRichText: isRichTextEnabled,
                replyEventId: replyEventId,
            };
            localStorage.setItem(this.editorStateKey, JSON.stringify(item));
        } else {
            this.clearStoredEditorState();
        }
    };

    // should save state when wysiwyg is enabled and has contents or reply is open
    private shouldSaveWysiwygEditorState = (): boolean => {
        const { isWysiwygLabEnabled, isComposerEmpty } = this.state;
        return isWysiwygLabEnabled && (!isComposerEmpty || !!this.props.replyToEvent);
    };

    private clearStoredEditorState(): void {
        localStorage.removeItem(this.editorStateKey);
    }

    private get voiceRecording(): Optional<VoiceMessageRecording> {
        return this._voiceRecording;
    }

    private set voiceRecording(rec: Optional<VoiceMessageRecording>) {
        if (this._voiceRecording) {
            this._voiceRecording.off(RecordingState.Started, this.onRecordingStarted);
            this._voiceRecording.off(RecordingState.EndingSoon, this.onRecordingEndingSoon);
        }

        this._voiceRecording = rec;

        if (rec) {
            // Delay saying we have a recording until it is started, as we might not yet
            // have A/V permissions
            rec.on(RecordingState.Started, this.onRecordingStarted);

            // We show a little heads up that the recording is about to automatically end soon. The 3s
            // display time is completely arbitrary.
            rec.on(RecordingState.EndingSoon, this.onRecordingEndingSoon);
        }
    }


    private onResize = (type: UI_EVENTS, entry: ResizeObserverEntry): void => {
        if (type === UI_EVENTS.Resize) {
            const { narrow } = this.context;
            this.setState({
                isMenuOpen: !narrow ? false : this.state.isMenuOpen,
                isStickerPickerOpen: false,
            });
        }
    };


    // 1) Keep ONE componentDidMount with ALL the logic merged
    public componentDidMount(): void {
        // Subscribe to voice recording store updates
        VoiceRecordingStore.instance.on(UPDATE_EVENT, this.onVoiceStoreUpdate);

        // Persist/restore WYSIWYG state across reloads
        window.addEventListener("beforeunload", this.saveWysiwygEditorState);
        if (this.state.isWysiwygLabEnabled) {
            const wysiwygState = this.restoreWysiwygEditorState();
            if (wysiwygState?.replyEventId) {
                dis.dispatch({
                    action: "reply_to_event",
                    event: this.props.room.findEventById(wysiwygState.replyEventId),
                    context: this.context.timelineRenderingType,
                });
            }
        }

        // Watch relevant settings
        SettingsStore.monitorSetting("MessageComposerInput.showStickersButton", null);
        SettingsStore.monitorSetting("MessageComposerInput.showPollsButton", null);
        SettingsStore.monitorSetting("feature_wysiwyg_composer", null);

        // Register dispatcher
        this.dispatcherRef = dis.register(this.onAction);

        // UI + member bootstrap
        this.waitForOwnMember();
        UIStore.instance.trackElementDimensions(`MessageComposer${this.instanceId}`, this.ref.current!);
        UIStore.instance.on(`MessageComposer${this.instanceId}`, this.onResize);

        // Sync initial recording state (handles cached recordings)
        this.updateRecordingState();

        // Check if chat should show reopen buttons and listen to room state changes
        this.checkIfShouldShowReopenButtons();
        this.props.room.on(RoomEvent.Timeline, this.onMyEventSent);
        this.props.room.on(RoomStateEvent.Members, this.onRoomMembersUpdate);
        this.props.room.on(RoomEvent.MyMembership, this.onRoomMembersUpdate);
    }


    // 2) Keep ONE componentWillUnmount that undoes everything
    public componentWillUnmount(): void {
        // Unsubscribe from stores and UI listeners
        VoiceRecordingStore.instance.off(UPDATE_EVENT, this.onVoiceStoreUpdate);
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);

        UIStore.instance.stopTrackingElementDimensions(`MessageComposer${this.instanceId}`);
        UIStore.instance.removeListener(`MessageComposer${this.instanceId}`, this.onResize);

        // Persist editor state and remove window listener
        window.removeEventListener("beforeunload", this.saveWysiwygEditorState);
        this.saveWysiwygEditorState();

        // Remove voice recording listeners via setter cleanup
        this.voiceRecording = null;

        // Remove room state listeners
        this.props.room.removeListener(RoomEvent.Timeline, this.onMyEventSent);
        this.props.room.removeListener(RoomStateEvent.Members, this.onRoomMembersUpdate);
        this.props.room.removeListener(RoomEvent.MyMembership, this.onRoomMembersUpdate);
    }


    // 1) add a class method (below other handlers)
    private onMyEventSent = (ev: MatrixEvent, room?: Room): void => {
        // Only care about our current room & our own successfully-sent events
        if (!room || room.roomId !== this.props.room.roomId) return;

        const mx = MatrixClientPeg.safeGet();
        if (ev.getSender() !== mx.getUserId()) return;

        // ignore local-echo / pending sends; wait until it's sent to the server
        const status = ev.status;
        if (status !== null && status !== undefined) return;

        const type = ev.getType();
        const content = ev.getContent() || {};
        const msgtype = content.msgtype;

        // --- Voice detection ---
        // Voice messages are m.room.message with msgtype "m.audio" and a voice flag:
        //   content["org.matrix.msc2516.voice"] OR content["m.voice"] (stable)
        const isVoice =
            type === "m.room.message" &&
            msgtype === "m.audio" &&
            (Boolean(content["org.matrix.msc2516.voice"]) || Boolean(content["m.voice"]));

        // --- Poll detection ---
        // Both unstable and (where available) stable event types:
        const isPoll =
            type === "org.matrix.msc3381.poll.start" || type === "m.poll.start";

        // --- Location detection ---
        // Location notifications are handled in shareLocation.ts to avoid duplicates
        // const isLocation =
        //     (type === "m.room.message" && msgtype === "m.location") ||
        //     type === "m.location";

        if (isVoice) {
            this.notifyPushNotifications().catch(e =>
                logger.warn("notifyPushNotifications(voice) error:", e),
            );
            return;
        }
        if (isPoll) {
            this.notifyPushNotifications().catch(e =>
                logger.warn("notifyPushNotifications(poll) error:", e),
            );
            return;
        }
        // Location notifications are handled in shareLocation.ts to avoid duplicates
        // if (isLocation) {
        //     this.notifyPushNotifications().catch(e =>
        //         logger.warn("notifyPushNotifications(location) error:", e),
        //     );
        // }
    };


    // 3) Keep ONE onAction
    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case "reply_to_event": {
                if (payload.context === this.context.timelineRenderingType) {
                    // allow reply preview to render before resize measurement
                    window.setTimeout(() => {
                        this.props.resizeNotifier.notifyTimelineHeightChanged();
                    }, 100);
                }
                break;
            }

            case Action.SettingUpdated: {
                const p = payload as SettingUpdatedPayload;
                switch (p.settingName) {
                    case "MessageComposerInput.showStickersButton":
                        this.setState({
                            showStickersButton: SettingsStore.getValue("MessageComposerInput.showStickersButton"),
                        });
                        break;
                    case "MessageComposerInput.showPollsButton":
                        this.setState({
                            showPollsButton: SettingsStore.getValue("MessageComposerInput.showPollsButton"),
                        });
                        break;
                    case "feature_wysiwyg_composer":
                        this.setState({ isWysiwygLabEnabled: Boolean(p.newValue) });
                        break;
                }
                break;
            }

            default:
                // ignore everything else
                break;
        }
    };



    private waitForOwnMember(): void {
        // If we have the member already, do that
        const me = this.props.room.getMember(MatrixClientPeg.safeGet().getUserId()!);
        if (me) {
            this.setState({ me });
            return;
        }
        // Otherwise, wait for member loading to finish and then update the member for the avatar.
        // The members should already be loading, and loadMembersIfNeeded
        // will return the promise for the existing operation
        this.props.room.loadMembersIfNeeded().then(() => {
            const me = this.props.room.getMember(MatrixClientPeg.safeGet().getSafeUserId()) ?? undefined;
            this.setState({ me });
        });
    }

    // public componentWillUnmount(): void {
    //     VoiceRecordingStore.instance.off(UPDATE_EVENT, this.onVoiceStoreUpdate);
    //     dis.unregister(this.dispatcherRef);
    //     UIStore.instance.stopTrackingElementDimensions(`MessageComposer${this.instanceId}`);
    //     UIStore.instance.removeListener(`MessageComposer${this.instanceId}`, this.onResize);

    //     window.removeEventListener("beforeunload", this.saveWysiwygEditorState);
    //     this.saveWysiwygEditorState();
    //     // clean up our listeners by setting our cached recording to falsy (see internal setter)
    //     this.voiceRecording = null;
    // }

    private onTombstoneClick = (ev: ButtonEvent): void => {
        ev.preventDefault();

        const replacementRoomId = this.context.tombstone?.getContent()["replacement_room"];
        const replacementRoom = MatrixClientPeg.safeGet().getRoom(replacementRoomId);
        let createEventId: string | undefined;
        if (replacementRoom) {
            const createEvent = replacementRoom.currentState.getStateEvents(EventType.RoomCreate, "");
            if (createEvent?.getId()) createEventId = createEvent.getId();
        }

        const sender = this.context.tombstone?.getSender();
        const viaServers = sender ? [sender.split(":").slice(1).join(":")] : undefined;

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            highlighted: true,
            event_id: createEventId,
            room_id: replacementRoomId,
            auto_join: true,
            // Try to join via the server that sent the event. This converts @something:example.org
            // into a server domain by splitting on colons and ignoring the first entry ("@something").
            via_servers: viaServers,
            metricsTrigger: "Tombstone",
            metricsViaKeyboard: ev.type !== "click",
        });
    };

    private getNotificationTitle(): string {
        const cli = MatrixClientPeg.safeGet();
        const fullId = cli.getUserId()!;
        const senderLocalPart =
            fullId.startsWith("@") && fullId.includes(":") ? fullId.slice(1, fullId.indexOf(":")) : fullId;
        const senderDisplayName = cli.getUser(fullId)?.displayName?.trim();
        return senderDisplayName || senderLocalPart;
    }

    private async sendReopenNotification(targetUserId: string): Promise<void> {
        try {
            const notificationTitle = this.getNotificationTitle();
            await fetch(`${NOTIFICATION_API_BASE_URL}/send-notification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: targetUserId,
                    notificationTitle,
                    notificationBody: "Got Invited",
                }),
            });
        } catch (err) {
            logger.warn(`Failed to send reopen notification to ${targetUserId}`, err);
        }
    }

    private async notifyPushNotifications(notificationBody: string = "Text"): Promise<void> {
        const fullId = MatrixClientPeg.get()!.getSafeUserId()!;
        const notificationTitle = this.getNotificationTitle();
        const others = this.props.room.getJoinedMembers().filter(m => m.userId !== fullId);

        for (const member of others) {
            try {
                const { fcmtoken, is_iOS } = await fetchUserTokenAndPlatform(member.userId);
                console.log(`Fetched FCM token for ${member.userId}:`, fcmtoken);
                console.log(`Is iOS platform:`, is_iOS);

                await fetch(`${NOTIFICATION_API_BASE_URL}/send-notification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: member.userId,
                        notificationTitle,
                        notificationBody,
                    }),
                });
            } catch (err) {
                console.warn(`Failed to send FCM to ${member.userId}:`, err);
            }
        }
    }


    private renderPlaceholderText = (): string => {
        if (this.props.replyToEvent) {
            const replyingToThread = this.props.relation?.rel_type === THREAD_RELATION_TYPE.name;
            if (replyingToThread && this.props.e2eStatus) {
                return _t("composer|placeholder_thread_encrypted");
            } else if (replyingToThread) {
                return _t("composer|placeholder_thread");
            } else if (this.props.e2eStatus) {
                return _t("composer|placeholder_reply_encrypted");
            } else {
                return _t("composer|placeholder_reply");
            }
        } else {
            if (this.props.e2eStatus) {
                return _t("composer|placeholder_encrypted");
            } else {
                return _t("composer|placeholder");
            }
        }
    };

    private addEmoji = (emoji: string): boolean => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            text: emoji,
            timelineRenderingType: this.context.timelineRenderingType,
        });
        return true;
    };

    private sendMessage = async (): Promise<void> => {
        // 1) If there’s an active voice recording, send that instead and notify
        if (this.state.haveRecording && this.voiceRecordingButton.current) {
            await this.voiceRecordingButton.current.send();
            try {
                await this.notifyPushNotifications("Voice Message");
            } catch (err) {
                logger.warn("notifyPushNotifications(voice click) error:", err);
            }
            return;
        }

        // 2) Use the stored composerContent and determine emptiness
        const raw = this.state.composerContent ?? "";
        const message = raw.trim();

        console.log("Notification title:", this.getNotificationTitle());
        console.log("User message:", message);

        // 4) Send FCM notification to other members ONLY if message has content
        if (message.length > 0) {
            try {
                await this.notifyPushNotifications(message);
            } catch (err) {
                logger.warn("notifyPushNotifications(text) error:", err);
            }
        }

        // 5) Trigger the basic composer send
        this.messageComposerInput.current?.sendMessage();

        // 6) If in WYSIWYG mode, clear state and dispatch the rich-text send
        if (this.state.isWysiwygLabEnabled) {
            const { relation, replyToEvent } = this.props;
            this.setState({ composerContent: "", initialComposerContent: "" });
            dis.dispatch({
                action: Action.ClearAndFocusSendMessageComposer,
                timelineRenderingType: this.context.timelineRenderingType,
            });
            await sendMessage(message, this.state.isRichTextEnabled, {
                mxClient: this.props.mxClient,
                roomContext: this.context,
                relation,
                replyToEvent,
            });
        }
    };





    private onChange = (model: EditorModel): void => {
        this.setState({
            isComposerEmpty: model.isEmpty,
        });
    };

    private onWysiwygChange = (content: string): void => {
        this.setState({
            composerContent: content,
            isComposerEmpty: content?.length === 0,
        });
    };

    private onRichTextToggle = async (): Promise<void> => {
        const { richToPlain, plainToRich } = await getConversionFunctions();

        const { isRichTextEnabled, composerContent } = this.state;
        const convertedContent = isRichTextEnabled
            ? await richToPlain(composerContent, false)
            : await plainToRich(composerContent, false);

        this.setState({
            isRichTextEnabled: !isRichTextEnabled,
            composerContent: convertedContent,
            initialComposerContent: convertedContent,
        });
    };

    private onVoiceStoreUpdate = (): void => {
        this.updateRecordingState();
    };

    private updateRecordingState(): void {
        const voiceRecordingId = VoiceRecordingStore.getVoiceRecordingId(this.props.room, this.props.relation);
        this.voiceRecording = VoiceRecordingStore.instance.getActiveRecording(voiceRecordingId);
        if (this.voiceRecording) {
            // If the recording has already started, it's probably a cached one.
            if (this.voiceRecording.hasRecording && !this.voiceRecording.isRecording) {
                this.setState({ haveRecording: true });
            }

            // Note: Listeners for recording states are set by the `this.voiceRecording` setter.
        } else {
            this.setState({ haveRecording: false });
        }
    }

    private onRecordingStarted = (): void => {
        // update the recording instance, just in case
        const voiceRecordingId = VoiceRecordingStore.getVoiceRecordingId(this.props.room, this.props.relation);
        this.voiceRecording = VoiceRecordingStore.instance.getActiveRecording(voiceRecordingId);
        this.setState({
            haveRecording: !!this.voiceRecording,
        });
    };

    private onRecordingEndingSoon = ({ secondsLeft }: { secondsLeft: number }): void => {
        this.setState({ recordingTimeLeftSeconds: secondsLeft });
        window.setTimeout(() => this.setState({ recordingTimeLeftSeconds: undefined }), 3000);
    };

    private checkIfShouldShowReopenButtons = (): void => {
        const room = this.props.room;
        let otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);

        // If not marked as DM, check if it's a 1-on-1 chat (2 members) and auto-mark it
        if (!otherUserId) {
            const totalMembers = room.getInvitedAndJoinedMemberCount();
            if (totalMembers === 2) {
                // It's a 1-on-1 chat - find the other user and mark it as DM
                const cli = MatrixClientPeg.safeGet();
                const myUserId = cli.getUserId();
                // Try to find the other member (joined first, then invited)
                let otherMember = room.getJoinedMembers().find(m => m.userId !== myUserId);
                if (!otherMember) {
                    const invitedMembers = room.getMembersWithMembership(KnownMembership.Invite);
                    otherMember = invitedMembers.find(m => m.userId !== myUserId);
                }

                if (otherMember) {
                    otherUserId = otherMember.userId;
                    // Auto-mark this room as a DM
                    setDMRoom(cli, room.roomId, otherUserId).catch(err => {
                        logger.warn(`Failed to auto-mark room ${room.roomId} as DM`, err);
                    });
                }
            }
        }

        if (!otherUserId) {
            // Not a DM, reset state
            this.setState({ shouldShowReopenButtons: false, otherUserId: undefined });
            return;
        }

        const myMembership = room.getMyMembership();
        const otherMember = room.getMember(otherUserId);

        // Show buttons if:
        // 1. I left the room (myMembership === Leave) AND other user is still in (joined or invited)
        // 2. OR I'm still in (joined) AND other user left
        const shouldShow =
            (myMembership === KnownMembership.Leave &&
                otherMember &&
                (otherMember.membership === KnownMembership.Join || otherMember.membership === KnownMembership.Invite)) ||
            (myMembership === KnownMembership.Join &&
                (!otherMember || otherMember.membership === KnownMembership.Leave));

        this.setState({
            shouldShowReopenButtons: shouldShow,
            otherUserId: shouldShow ? otherUserId : undefined,
        });
    };

    private onRoomMembersUpdate = (): void => {
        this.checkIfShouldShowReopenButtons();
    };

    private handleReopenChat = async (): Promise<void> => {
        const { room } = this.props;
        const { otherUserId } = this.state;

        if (!otherUserId) {
            logger.error("Try to reopen a room that is not a DM room. This should not be possible from the UI!");
            return;
        }

        try {
            const cli = MatrixClientPeg.safeGet();
            const myMembership = room.getMyMembership();

            // If we left, rejoin first
            if (myMembership === KnownMembership.Leave) {
                await cli.joinRoom(room.roomId);
                logger.info(`Rejoined room ${room.roomId}`);
            }

            // Ensure room is marked as DM
            await setDMRoom(cli, room.roomId, otherUserId);
            logger.info(`Marked room ${room.roomId} as DM for ${otherUserId}`);

            // Simply invite the user (following FluffyChat's approach)
            // Send invite with is_direct flag for FluffyChat compatibility
            try {
                await cli.sendStateEvent(
                    room.roomId,
                    EventType.RoomMember,
                    {
                        membership: KnownMembership.Invite,
                        is_direct: true,
                    },
                    otherUserId
                );
                logger.info(`Invited ${otherUserId} to room ${room.roomId} with is_direct flag`);
            } catch (err) {
                // Fallback to standard invite if sendStateEvent fails
                logger.warn("Failed to send invite with is_direct, falling back to standard invite", err);
                await cli.invite(room.roomId, otherUserId);
                logger.info(`Invited ${otherUserId} to room ${room.roomId} (fallback)`);
            }

            await this.sendReopenNotification(otherUserId);
        } catch (err) {
            logger.error("Failed to reopen chat:", err);
        }
    };

    private handleDeleteChat = async (): Promise<void> => {
        const { room } = this.props;
        const roomId = room.roomId;

        try {
            const cli = MatrixClientPeg.safeGet();
            const myMembership = room.getMyMembership();

            // Only leave if we're still in the room
            if (myMembership === KnownMembership.Join) {
                await leaveRoomBehaviour(cli, roomId);

                dis.dispatch<AfterLeaveRoomPayload>({
                    action: DispatcherAction.AfterLeaveRoom,
                    room_id: roomId,
                });
            } else {
                // Already left, just navigate away
                dis.dispatch<AfterLeaveRoomPayload>({
                    action: DispatcherAction.AfterLeaveRoom,
                    room_id: roomId,
                });
            }
        } catch (err) {
            logger.error("Failed to delete chat:", err);
        }
    };

    private setStickerPickerOpen = (isStickerPickerOpen: boolean): void => {
        this.setState({
            isStickerPickerOpen,
            isMenuOpen: false,
        });
    };

    private toggleStickerPickerOpen = (): void => {
        this.setStickerPickerOpen(!this.state.isStickerPickerOpen);
    };

    private toggleButtonMenu = (): void => {
        this.setState({
            isMenuOpen: !this.state.isMenuOpen,
        });
    };

    private get showStickersButton(): boolean {
        return this.state.showStickersButton && !isLocalRoom(this.props.room);
    }

    private getMenuPosition(): MenuProps | undefined {
        if (this.ref.current) {
            const hasFormattingButtons = this.state.isWysiwygLabEnabled && this.state.isRichTextEnabled;
            const contentRect = this.ref.current.getBoundingClientRect();
            // Here we need to remove the all the extra space above the editor
            // Instead of doing a querySelector or pass a ref to find the compute the height formatting buttons
            // We are using an arbitrary value, the formatting buttons height doesn't change during the lifecycle of the component
            // It's easier to just use a constant here instead of an over-engineering way to find the height
            const heightToRemove = hasFormattingButtons ? 36 : 0;
            const fixedRect = new DOMRect(
                contentRect.x,
                contentRect.y + heightToRemove,
                contentRect.width,
                contentRect.height - heightToRemove,
            );
            return aboveLeftOf(fixedRect);
        }
    }

    private onRecordStartEndClick = (): void => {
        this.voiceRecordingButton.current?.onRecordStartEndClick();

        if (this.context.narrow) {
            this.toggleButtonMenu();
        }
    };

    public render(): React.ReactNode {
        const hasE2EIcon = Boolean(!this.state.isWysiwygLabEnabled && this.props.e2eStatus);
        const e2eIcon = hasE2EIcon && (
            <div className="mx_MessageComposer_e2eIconWrapper">
                <E2EIcon key="e2eIcon" status={this.props.e2eStatus!} className="mx_MessageComposer_e2eIcon" />
            </div>
        );

        const controls: ReactNode[] = [];
        const menuPosition = this.getMenuPosition();

        // Check if we should show reopen buttons (user left or other user left in DM)
        const shouldShowReopenButtons = this.state.shouldShowReopenButtons && this.state.otherUserId;

        const canSendMessages = this.context.canSendMessages && !this.context.tombstone && !shouldShowReopenButtons;
        let composer: ReactNode;
        if (canSendMessages) {
            if (this.state.isWysiwygLabEnabled && menuPosition) {
                composer = (
                    <SendWysiwygComposer
                        key="controls_input"
                        disabled={this.state.haveRecording}
                        onChange={this.onWysiwygChange}
                        onSend={this.sendMessage}
                        isRichTextEnabled={this.state.isRichTextEnabled}
                        initialContent={this.state.initialComposerContent}
                        e2eStatus={this.props.e2eStatus}
                        menuPosition={menuPosition}
                        placeholder={this.renderPlaceholderText()}
                        eventRelation={this.props.relation}
                    />
                );
            } else {
                composer = (
                    <SendMessageComposer
                        ref={this.messageComposerInput}
                        key="controls_input"
                        room={this.props.room}
                        placeholder={this.renderPlaceholderText()}
                        relation={this.props.relation}
                        replyToEvent={this.props.replyToEvent}
                        onChange={this.onChange}
                        disabled={this.state.haveRecording}
                        toggleStickerPickerOpen={this.toggleStickerPickerOpen}
                    />
                );
            }

            controls.push(
                <VoiceRecordComposerTile
                    key="controls_voice_record"
                    ref={this.voiceRecordingButton}
                    room={this.props.room}
                    relation={this.props.relation}
                    replyToEvent={this.props.replyToEvent}
                />,
            );
        } else if (this.context.tombstone) {
            const replacementRoomId = this.context.tombstone.getContent()["replacement_room"];

            const continuesLink = replacementRoomId ? (
                <a
                    href={makeRoomPermalink(MatrixClientPeg.safeGet(), replacementRoomId)}
                    className="mx_MessageComposer_roomReplaced_link"
                    onClick={this.onTombstoneClick}
                >
                    {_t("composer|room_upgraded_link")}
                </a>
            ) : (
                ""
            );

            controls.push(
                <div className="mx_MessageComposer_replaced_wrapper" key="room_replaced">
                    <div className="mx_MessageComposer_replaced_valign">
                        <img
                            aria-hidden
                            alt=""
                            className="mx_MessageComposer_roomReplaced_icon"
                            src={RoomReplacedSvg}
                        />
                        <span className="mx_MessageComposer_roomReplaced_header">
                            {_t("composer|room_upgraded_notice")}
                        </span>
                        <br />
                        {continuesLink}
                    </div>
                </div>,
            );
        } else if (shouldShowReopenButtons) {
            // Show delete and reopen buttons when user left or other user left in DM
            controls.push(
                <div key="controls_chat_left" className="mx_MessageComposer_chat_left_wrapper">
                    <div className="mx_MessageComposer_chat_left_message">
                        {_t("composer|user_left_chat_message")}
                    </div>
                    <div className="mx_MessageComposer_chat_left_buttons">
                        <AccessibleButton
                            className="mx_MessageComposer_chat_left_button mx_MessageComposer_chat_left_button_delete"
                            onClick={this.handleDeleteChat}
                            kind="danger"
                        >
                            {_t("composer|delete_chat")}
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_MessageComposer_chat_left_button mx_MessageComposer_chat_left_button_reopen"
                            onClick={this.handleReopenChat}
                            kind="primary"
                        >
                            {_t("composer|reopen_chat")}
                        </AccessibleButton>
                    </div>
                </div>,
            );
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    {_t("composer|no_perms_notice")}
                </div>,
            );
        }

        const isTooltipOpen = Boolean(this.state.recordingTimeLeftSeconds);
        const secondsLeft = this.state.recordingTimeLeftSeconds ? Math.round(this.state.recordingTimeLeftSeconds) : 0;

        const threadId =
            this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation.event_id : null;

        controls.push(
            <Stickerpicker
                room={this.props.room}
                threadId={threadId}
                isStickerPickerOpen={this.state.isStickerPickerOpen}
                setStickerPickerOpen={this.setStickerPickerOpen}
                menuPosition={menuPosition}
                key="stickers"
            />,
        );

        const showSendButton = canSendMessages && (!this.state.isComposerEmpty || this.state.haveRecording);

        const classes = classNames({
            "mx_MessageComposer": true,
            "mx_MessageComposer--compact": this.props.compact,
            "mx_MessageComposer_e2eStatus": hasE2EIcon,
            "mx_MessageComposer_wysiwyg": this.state.isWysiwygLabEnabled,
        });

        return (
            <Tooltip open={isTooltipOpen} description={formatTimeLeft(secondsLeft)} placement="bottom">
                <div className={classes} ref={this.ref} role="region" aria-label={_t("a11y|message_composer")}>
                    <div className="mx_MessageComposer_wrapper">
                        <UserIdentityWarning room={this.props.room} key={this.props.room.roomId} />
                        <ReplyPreview
                            replyToEvent={this.props.replyToEvent}
                            permalinkCreator={this.props.permalinkCreator}
                        />
                        <div className="mx_MessageComposer_row">
                            {e2eIcon}
                            {composer}
                            <div className="mx_MessageComposer_actions">
                                {controls}
                                {canSendMessages && (
                                    <MessageComposerButtons
                                        addEmoji={this.addEmoji}
                                        haveRecording={this.state.haveRecording}
                                        isMenuOpen={this.state.isMenuOpen}
                                        isStickerPickerOpen={this.state.isStickerPickerOpen}
                                        menuPosition={menuPosition}
                                        relation={this.props.relation}
                                        onRecordStartEndClick={this.onRecordStartEndClick}
                                        setStickerPickerOpen={this.setStickerPickerOpen}
                                        showLocationButton={
                                            !window.electron && SettingsStore.getValue(UIFeature.LocationSharing)
                                        }
                                        showPollsButton={this.state.showPollsButton}
                                        showStickersButton={this.showStickersButton}
                                        isRichTextEnabled={this.state.isRichTextEnabled}
                                        onComposerModeClick={this.onRichTextToggle}
                                        toggleButtonMenu={this.toggleButtonMenu}
                                    />
                                )}
                                {showSendButton && (
                                    <SendButton
                                        key="controls_send"
                                        onClick={this.sendMessage}
                                        title={
                                            this.state.haveRecording
                                                ? _t("composer|send_button_voice_message")
                                                : undefined
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Tooltip>
        );
    }
}

const MessageComposerWithMatrixClient = withMatrixClientHOC(MessageComposer);
export default MessageComposerWithMatrixClient;
