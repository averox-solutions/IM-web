/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

PDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Body as BodyText, IconButton, Tooltip } from "@vector-im/compound-web";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";
import RoomInfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info-solid";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";

import { JoinRule } from "matrix-js-sdk/src/matrix";
import type { Room } from "matrix-js-sdk/src/matrix";
import type { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";
import { useRoomName } from "../../../../hooks/useRoomName";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useRoomMemberCount, useRoomMembers } from "../../../../hooks/useRoomMembers";
import { _t } from "../../../../languageHandler";
import { Flex } from "../../../utils/Flex";
import { Box } from "../../../utils/Box";
import { useGlobalNotificationState } from "../../../../hooks/useGlobalNotificationState";
import { useFeatureEnabled } from "../../../../hooks/useSettings";
import { useEncryptionStatus } from "../../../../hooks/useEncryptionStatus";
import { E2EStatus } from "../../../../utils/ShieldUtils";
import { useRoomState } from "../../../../hooks/useRoomState";
import { formatCount } from "../../../../utils/FormattingUtils";
import type { ButtonEvent } from "../../elements/AccessibleButton";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { RoomSettingsTab } from "../../dialogs/RoomSettingsDialog";
import FacePile from "../../elements/FacePile";
import RoomAvatar from "../../avatars/RoomAvatar";
import { notificationLevelToIndicator } from "../../../../utils/notifications";
import WithPresenceIndicator, { useDmMember } from "../../avatars/WithPresenceIndicator";
import type { IOOBData } from "../../../../stores/ThreepidInviteStore";
import RightPanelStore from "../../../../stores/right-panel/RightPanelStore";
import { RoomKnocksBar } from "../RoomKnocksBar";
import { ToggleableIcon } from "./toggle/ToggleableIcon";
import { CurrentRightPanelPhaseContextProvider } from "../../../../contexts/CurrentRightPanelPhaseContext";
import { initializeSocketIfNeeded } from "../../rooms/Calling/socketInitializer";
import CallModal from "../Calling/CallModal";
import { VideoRoom } from "../livekit_calling/VideoRoom";
import LiveKitRoomManager from "../livekit_calling/LiveKitRoomManager";
import LegacyCallHandler, { AudioID } from "../../../../LegacyCallHandler";
import { showToast } from "../Calling/notificationUtils";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { isVideoRoom as calcIsVideoRoom } from "../../../../utils/video-rooms.ts";
import { MainSplitContentType } from "../../../structures/RoomView.tsx";
import { VideoRoomChatButton } from "./VideoRoomChatButton.tsx";
import Modal from "../../../../Modal";
import SetupEncryptionDialog from "../../dialogs/security/SetupEncryptionDialog";

export default function RoomHeader({
    room,
    oobData,
}: {
    room: Room;
    additionalButtons?: ViewRoomOpts["buttons"];
    oobData?: IOOBData;
}): JSX.Element {
    const client = useMatrixClientContext();
    const roomName = useRoomName(room);
    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const members = useRoomMembers(room, 2500);
    const memberCount = useRoomMemberCount(room, { throttleWait: 2500 });
    const globalNotificationState = useGlobalNotificationState();

    // LiveKit call state
    const [isLiveKitCallActive, setIsLiveKitCallActive] = useState(false);
    const [liveKitCallData, setLiveKitCallData] = useState<any>(null);
    const [liveKitCallType, setLiveKitCallType] = useState<"video" | "voice">("video");

    // Active call state for when user accepts an incoming call
    const [activeCallData, setActiveCallData] = useState<any>(null);

    const currentUser = room.getMember(client.getUserId() || "");
    const currentUserId = client.getUserId();
    const otherMember = members.filter((member) => member.userId !== currentUserId);

    // Handle incoming call acceptance
    const handleAcceptIncomingCall = useCallback(
        (callData: any): void => {
            console.log("✅ Accepting incoming LiveKit call:", callData);

            // Remove any existing LiveKit call notifications to prevent overlay issues
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
            } else {
                // Fallback if function not available yet
                document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
            }
            console.log("🧹 Removed all existing LiveKit call notifications");

            // Stop ring sound when accepting
            LegacyCallHandler.instance.pause(AudioID.Ring);

            // Prepare call data for LiveKitRoomManager
            const activeCall = {
                roomId: callData.roomId,
                participantName: currentUserId || "Unknown User",
                token: callData.token,
                serverUrl: callData.serverUrl,
                e2eeKey: callData.e2eeKey,
                callType: callData.isVideo ? ("video" as const) : ("voice" as const),
                isIncoming: true,
            };

            setActiveCallData(activeCall);

            // TODO: Send acceptance response to backend
            console.log("📤 Should send call acceptance to backend");
        },
        [currentUserId],
    );

    // Handle incoming call rejection
    const handleRejectIncomingCall = useCallback(
        (callData: any): void => {
            console.log("❌ Rejecting incoming LiveKit call:", callData);

            // Remove any existing LiveKit call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
            } else {
                // Fallback if function not available yet
                document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
            }
            console.log("🧹 Removed all existing LiveKit call notifications");

            // Stop ring sound when rejecting
            LegacyCallHandler.instance.pause(AudioID.Ring);

            // Send rejection response to backend
            const socket = initializeSocketIfNeeded();
            if (socket && callData) {
                const declineData = {
                    roomId: callData.roomId,
                    fromUserId: callData.fromUserId,
                    toUserId: currentUserId,
                    isGroup: callData.isGroup || false,
                    timestamp: new Date().toISOString(),
                };

                console.log("📤 Emitting CALL_DECLINED event:", declineData);
                socket.emit("call_declined", declineData);
            } else {
                console.warn("❌ Cannot send call rejection - socket or callData not available");
            }
        },
        [currentUserId],
    );

    // Initialize socket when component mounts
    useEffect(() => {
        const initSocket = async (): Promise<void> => {
            try {
                const socket = initializeSocketIfNeeded();
                if (socket) {
                    console.log("Socket initialized successfully");

                    // Listen for socket connection events
                    socket.on("connect", () => {
                        console.log("Socket connected");
                    });

                    socket.on("disconnect", () => {
                        console.log("Socket disconnected");
                    });

                    // If socket is already connected when initialized
                    if (socket.connected) {
                        console.log("Socket already connected");
                    }
                } else {
                    console.error("Failed to initialize socket");
                }
            } catch (error) {
                console.error("Error initializing socket:", error);
            }
        };

        initSocket();

        // Listen for incoming LiveKit calls
        const handleIncomingLiveKitCall = (event: Event): void => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail) {
                console.log("📞 Received incoming LiveKit call in RoomHeader:", customEvent.detail);

                // Show our professional notification for incoming call
                const callData = customEvent.detail;
                const caller = callData.isGroup ? callData.groupName : callData.fromUsername;

                // Start playing ring sound for incoming LiveKit call
                console.log("🔊 Starting ring sound for incoming LiveKit call");
                LegacyCallHandler.instance.play(AudioID.Ring).catch((error) => {
                    console.warn("Failed to play ring sound:", error);
                });

                // Show notification using our professional system - this handles everything
                const notificationId = (window as any).showLiveKitCallNotification("incoming", {
                    caller: caller,
                    isVideo: callData.isVideo,
                    onAccept: () => {
                        console.log("Incoming call accepted from notification");
                        // Stop ring sound when accepting from notification
                        LegacyCallHandler.instance.pause(AudioID.Ring);
                        handleAcceptIncomingCall(callData);
                    },
                    onDecline: () => {
                        console.log("Incoming call declined from notification");
                        // Stop ring sound when declining from notification
                        LegacyCallHandler.instance.pause(AudioID.Ring);
                        handleRejectIncomingCall(callData);
                    },
                    onDismiss: () => {
                        console.log("Incoming call notification dismissed (30s timeout)");
                        // Stop ring sound when auto-dismissed after 30s
                        LegacyCallHandler.instance.pause(AudioID.Ring);
                        handleRejectIncomingCall(callData);
                    },
                });

                console.log("📤 Showed incoming LiveKit call notification:", notificationId);
            }
        };

        window.addEventListener("incomingLiveKitCall", handleIncomingLiveKitCall);

        // Unified handler for call decline events
        const handleCallDeclined = (data: any): void => {
            console.log("📞 Received call decline event:", data);

            // Check if this decline is for our current outgoing call
            if (data.fromUserId === currentUserId) {
                console.log("📞 Our call was declined by:", data.declinedBy);

                // Close any active call screen
                if (isLiveKitCallActive) {
                    console.log("📞 Closing active LiveKit call due to decline");
                    closeLiveKitCall();
                }

                // Clear any outgoing call notifications
                if ((window as any).clearAllLiveKitCallNotifications) {
                    (window as any).clearAllLiveKitCallNotifications();
                }

                // Show toast notification that call was declined
                const declinedByUser = data.declinedBy || "User";
                showToast(`Call declined by ${declinedByUser}`, "info", 3000);

                console.log("📞 Call decline handled successfully");
            }
        };

        // Listen for both socket and custom events
        const currentSocket = initializeSocketIfNeeded();
        if (currentSocket) {
            currentSocket.on("call_declined", handleCallDeclined);
        }

        // Listen for custom LiveKit call declined events
        window.addEventListener("liveKitCallDeclined", (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail) {
                handleCallDeclined(customEvent.detail);
            }
        });

        // Cleanup function
        return () => {
            const cleanupSocket = initializeSocketIfNeeded();
            if (cleanupSocket) {
                cleanupSocket.off("connect");
                cleanupSocket.off("disconnect");
                cleanupSocket.off("call_declined", handleCallDeclined);
            }
            window.removeEventListener("incomingLiveKitCall", handleIncomingLiveKitCall);
            window.removeEventListener("liveKitCallDeclined", handleCallDeclined);
        };
    }, [handleAcceptIncomingCall, handleRejectIncomingCall, currentUserId, isLiveKitCallActive]);

    const allSamePowerLevel = React.useMemo(() => {
        const allMembers = [currentUser, ...otherMember];
        return allMembers.every((member) => member?.powerLevel === currentUser?.powerLevel);
    }, [currentUser, otherMember]);

    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;
    const e2eStatus = useEncryptionStatus(client, room);

    const notificationsEnabled = useFeatureEnabled("feature_notifications");
    const askToJoinEnabled = useFeatureEnabled("feature_ask_to_join");

    const onAvatarClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.General,
        });
    };

    // Helper: check if session is marked verified in localStorage
    const isSessionVerifiedLocally = (): boolean => {
        return localStorage.getItem("sessionVerified") === "true";
    };

    // Modified group call functions to use LiveKit with proper participant data
    async function GroupCallVideo(): Promise<void> {
        if (!isSessionVerifiedLocally()) {
            Modal.createDialog(SetupEncryptionDialog, { onFinished: () => {} });
            return;
        }
        console.log("🎥 Starting LiveKit video call");

        // Remove any existing notifications before starting outgoing call
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }

        // Gather participant data for the new calling format
        const participantData = gatherParticipantData();
        if (!participantData) {
            console.error("❌ Failed to gather participant data");
            return;
        }

        // Show our professional notification for outgoing call
        const participantCount = participantData.toUserIds.length;
        const targetName =
            participantCount === 1 ? Object.values(participantData.toUsernames)[0] : `${participantCount} participants`;

        // Show notification using our professional system
        const notificationId = (window as any).showLiveKitCallNotification("outgoing", {
            caller: targetName,
            isVideo: true,
            participantCount: participantCount,
            onDismiss: () => {
                console.log("Outgoing call notification dismissed");
            },
        });

        console.log("📤 Showed outgoing video call notification:", notificationId);

        // Set call as active and use new format
        setIsLiveKitCallActive(true);
        setLiveKitCallData(participantData);
        setLiveKitCallType("video");
    }

    async function GroupCallVoice(): Promise<void> {
        if (!isSessionVerifiedLocally()) {
            Modal.createDialog(SetupEncryptionDialog, { onFinished: () => {} });
            return;
        }
        console.log("🎙️ Starting LiveKit voice call");

        // Remove any existing notifications before starting outgoing call
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }

        // Gather participant data for the new calling format
        const participantData = gatherParticipantData();
        if (!participantData) {
            console.error("❌ Failed to gather participant data");
            return;
        }

        // Show our professional notification for outgoing call
        const participantCount = participantData.toUserIds.length;
        const targetName =
            participantCount === 1 ? Object.values(participantData.toUsernames)[0] : `${participantCount} participants`;

        // Show notification using our professional system
        const notificationId = (window as any).showLiveKitCallNotification("outgoing", {
            caller: targetName,
            isVideo: false,
            participantCount: participantCount,
            onDismiss: () => {
                console.log("Outgoing call notification dismissed");
            },
        });

        console.log("📤 Showed outgoing voice call notification:", notificationId);

        // Set call as active and use new format
        setIsLiveKitCallActive(true);
        setLiveKitCallData(participantData);
        setLiveKitCallType("voice");
    }
    const roomContext = useScopedRoomContext("mainSplitContentType");
    const isVideoRoom = calcIsVideoRoom(room);
    const showChatButton = isVideoRoom || roomContext.mainSplitContentType === MainSplitContentType.MaximisedWidget ||
        roomContext.mainSplitContentType === MainSplitContentType.Call;
    
    // Helper function to gather participant data for the call
    const gatherParticipantData = (): any => {
        try {
            // Get current user ID and username
            const currentUserId = client.getUserId();
            if (!currentUserId) {
                console.error("❌ Current user ID not available");
                return null;
            }

            // Get room members excluding current user
            const otherUsers = members.filter((member) => member.userId !== currentUserId);

            if (otherUsers.length === 0) {
                console.warn("⚠️ No other users found in room for calling");
                return null;
            }

            // Create participant data
            const toUserIds = otherUsers.map((member) => member.userId);
            const toUsernames: { [userId: string]: string } = {};

            otherUsers.forEach((member) => {
                // Use display name or fallback to user ID
                const displayName =
                    member.rawDisplayName || member.name || member.userId.replace(/^@/, "").split(":")[0];
                toUsernames[member.userId] = displayName;
            });

            const isGroupCall = otherUsers.length > 1;
            const groupName = isGroupCall ? roomName : null;

            const participantData = {
                roomId: room.roomId,
                toUserIds,
                toUsernames,
                fromUsername: currentUserId,
                groupName,
            };

            console.log("👥 Gathered participant data:", {
                roomId: participantData.roomId,
                participantCount: toUserIds.length,
                isGroupCall,
                toUserIds: toUserIds.map((id) => id.replace(/^@/, "").split(":")[0]),
                fromUsername: participantData.fromUsername,
                groupName: participantData.groupName,
            });

            return participantData;
        } catch (error) {
            console.error("❌ Error gathering participant data:", error);
            return null;
        }
    };

    // Function to close any active LiveKit call
    const closeLiveKitCall = (): void => {
        console.log("Closing LiveKit call");

        // Remove any existing LiveKit call notifications when closing call
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications on call close");

        setIsLiveKitCallActive(false);
        setLiveKitCallData(null);
        setActiveCallData(null);
    };

    // Hide sidebar when any LiveKit call is active
    useEffect(() => {
        const isAnyCallActive = isLiveKitCallActive || !!activeCallData;

        if (isAnyCallActive) {
            // Add class to body to hide sidebar and other UI elements
            document.body.classList.add("mx_LiveKitCall_active");
            console.log("🎥 Added LiveKit call active class to body");
        } else {
            // Remove class when call ends
            document.body.classList.remove("mx_LiveKitCall_active");
            console.log("🎥 Removed LiveKit call active class from body");
        }

        // Cleanup function
        return () => {
            document.body.classList.remove("mx_LiveKitCall_active");
        };
    }, [isLiveKitCallActive, activeCallData]);

    return (
        <>
            <CurrentRightPanelPhaseContextProvider roomId={room.roomId}>
                <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_RoomHeader light-panel">
                    <WithPresenceIndicator room={room} size="8px">
                        <RoomAvatar
                            room={room}
                            size="40px"
                            oobData={oobData}
                            onClick={allSamePowerLevel ? undefined : onAvatarClick}
                            tabIndex={-1}
                            aria-label={_t("room|header_avatar_open_settings_label")}
                        />
                    </WithPresenceIndicator>

                    <button
                        aria-label={_t("right_panel|room_summary_card|title")}
                        tabIndex={0}
                        onClick={() => {
                            if (!allSamePowerLevel) {
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary);
                            }
                        }}
                        disabled={allSamePowerLevel}
                        className="mx_RoomHeader_infoWrapper"
                    >
                        <Box flex="1" className="mx_RoomHeader_info">
                            <BodyText
                                as="div"
                                size="lg"
                                weight="semibold"
                                dir="auto"
                                role="heading"
                                aria-level={1}
                                className="mx_RoomHeader_heading"
                            >
                                <span className="mx_RoomHeader_truncated mx_lineClamp">{roomName}</span>

                                {!isDirectMessage && joinRule === JoinRule.Public && (
                                    <Tooltip label={_t("common|public_room")} placement="right">
                                        <PublicIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon text-secondary"
                                            aria-label={_t("common|public_room")}
                                        />
                                    </Tooltip>
                                )}

                                {isDirectMessage && e2eStatus === E2EStatus.Verified && (
                                    <Tooltip label={_t("common|verified")} placement="right">
                                        <VerifiedIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon mx_Verified"
                                            aria-label={_t("common|verified")}
                                        />
                                    </Tooltip>
                                )}

                                {isDirectMessage && e2eStatus === E2EStatus.Warning && (
                                    <Tooltip label={_t("room|header_untrusted_label")} placement="right">
                                        <ErrorIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon mx_Untrusted"
                                            aria-label={_t("room|header_untrusted_label")}
                                        />
                                    </Tooltip>
                                )}
                            </BodyText>
                        </Box>
                    </button>
                    <button
                        onClick={GroupCallVoice}
                        disabled={isLiveKitCallActive || !!activeCallData}
                        title={isLiveKitCallActive || activeCallData ? "Call in progress" : "Start voice call"}
                        style={{
                            backgroundColor: "rgb(72, 141, 65)",
                            border: "none",
                            borderRadius: "50%",
                            width: "40px",
                            height: "40px",
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s ease, opacity 0.2s ease",
                            cursor: isLiveKitCallActive || activeCallData ? "not-allowed" : "pointer",
                            opacity: isLiveKitCallActive || activeCallData ? 0.5 : 1,
                        }}
                    >
                        <VoiceCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                    </button>

                    <button
                        onClick={GroupCallVideo}
                        disabled={isLiveKitCallActive || !!activeCallData}
                        title={isLiveKitCallActive || activeCallData ? "Call in progress" : "Start video call"}
                        style={{
                            backgroundColor: "rgb(72, 141, 65)",
                            border: "none",
                            borderRadius: "50%",
                            width: "40px",
                            height: "40px",
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s ease, opacity 0.2s ease",
                            cursor: isLiveKitCallActive || activeCallData ? "not-allowed" : "pointer",
                            opacity: isLiveKitCallActive || activeCallData ? 0.5 : 1,
                        }}
                    >
                        <VideoCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                    </button>
                                    {showChatButton && (
                        <>
                        {/* FacePile (Member List) - show if showChatButton is true */}
                        <FacePile
                            className="mx_RoomHeader_members"
                            members={members.slice(0, 3)}  // Show first 3 members
                            size="20px"
                            overflow={false}
                            viewUserOnClick={false}
                            tooltipLabel={_t("room|header_face_pile_tooltip")}
                            onClick={(e: ButtonEvent) => {
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.MemberList);
                                e.stopPropagation();
                            }}
                            aria-label={_t("common|n_members", { count: memberCount })}
                        >
                            {formatCount(memberCount)}
                        </FacePile>

                        <Tooltip label={_t("right_panel|room_summary_card|title")}>
                            <IconButton
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary);
                                }}
                                aria-label={_t("right_panel|room_summary_card|title")}
                            >
                                <ToggleableIcon Icon={RoomInfoIcon} phase={RightPanelPhases.RoomSummary} />
                            </IconButton>
                        </Tooltip>
                        <VideoRoomChatButton room={room} />
                    </>
                )}

                    {notificationsEnabled && !allSamePowerLevel && (
                        <Tooltip label={_t("notifications|enable_prompt_toast_title")}>
                            <IconButton
                                indicator={notificationLevelToIndicator(globalNotificationState.level)}
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.NotificationPanel);
                                }}
                                aria-label={_t("notifications|enable_prompt_toast_title")}
                            >
                                <ToggleableIcon Icon={NotificationsIcon} phase={RightPanelPhases.NotificationPanel} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Room Summary Button - hide or disable if restricted */}
                    {!allSamePowerLevel && (
                        <Tooltip label={_t("right_panel|room_summary_card|title")}>
                            <IconButton
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary);
                                }}
                                aria-label={_t("right_panel|room_summary_card|title")}
                            >
                                <ToggleableIcon Icon={RoomInfoIcon} phase={RightPanelPhases.RoomSummary} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* FacePile (Member List) - hide if restricted */}
                    {!isDirectMessage && !allSamePowerLevel && (
                        <BodyText as="div" size="sm" weight="medium">
                            <FacePile
                                className="mx_RoomHeader_members"
                                members={members.slice(0, 3)}
                                size="20px"
                                overflow={false}
                                viewUserOnClick={false}
                                tooltipLabel={_t("room|header_face_pile_tooltip")}
                                onClick={(e: ButtonEvent) => {
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.MemberList);
                                    e.stopPropagation();
                                }}
                                aria-label={_t("common|n_members", { count: memberCount })}
                            >
                                {formatCount(memberCount)}
                            </FacePile>
                        </BodyText>
                    )}
                </Flex>
                {askToJoinEnabled && <RoomKnocksBar room={room} />}
            </CurrentRightPanelPhaseContextProvider>

            {/* Only show MediaSoup CallModal when there's no active LiveKit call */}
            {!activeCallData && !isLiveKitCallActive && <CallModal />}

            {/* Active LiveKit Call (from incoming call acceptance) */}
            {activeCallData && (
                <LiveKitRoomManager callData={activeCallData} isActive={!!activeCallData} onClose={closeLiveKitCall} />
            )}

            {/* LiveKit Video Room Overlay (for outgoing calls) */}
            {isLiveKitCallActive &&
                liveKitCallData &&
                ReactDOM.createPortal(
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.95)",
                            zIndex: 20000, // Higher than sidebar and all other components
                            display: "flex",
                            flexDirection: "column",
                            width: "100vw",
                            height: "100vh",
                        }}
                    >
                        {/* LiveKit VideoRoom Component with NEW FORMAT - Full Screen */}
                        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                            <VideoRoom
                                roomId={liveKitCallData.roomId}
                                toUserIds={liveKitCallData.toUserIds}
                                toUsernames={liveKitCallData.toUsernames}
                                isVideo={liveKitCallType === "video"}
                                fromUsername={liveKitCallData.fromUsername}
                                groupName={liveKitCallData.groupName}
                                testMode={{
                                    useWrongKey: false,
                                    customKey: undefined,
                                }}
                                onLeave={closeLiveKitCall}
                            />
                        </div>
                    </div>,
                    document.body, // Render at document.body level
                )}

            {/* Fallback for old format calls (backward compatibility) */}
            {isLiveKitCallActive &&
                !liveKitCallData &&
                ReactDOM.createPortal(
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.95)",
                            zIndex: 20000, // Higher than sidebar and all other components
                            display: "flex",
                            flexDirection: "column",
                            width: "100vw",
                            height: "100vh",
                        }}
                    >
                        {/* LiveKit VideoRoom Component with OLD FORMAT (fallback) - Full Screen */}
                        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                            <VideoRoom
                                roomName={room.roomId}
                                participantName={currentUserId || "Unknown User"}
                                isVideo={liveKitCallType === "video"}
                                testMode={{
                                    useWrongKey: false,
                                    customKey: undefined,
                                }}
                                onLeave={closeLiveKitCall}
                            />
                        </div>
                    </div>,
                    document.body, // Render at document.body level
                )}
        </>
    );
}
