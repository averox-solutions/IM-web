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
import { useRef, type ChangeEvent } from "react";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import { Search, Form } from "@vector-im/compound-web";

import {
    ChevronFace,
    ContextMenuTooltipButton,
    useContextMenu,
    type MenuProps,
    ContextMenuButton,
} from "../../../structures/ContextMenu";

import { BsPlus } from "react-icons/bs";

import classNames from "classnames";

import { useDispatcher } from "../../../../hooks/useDispatcher";
import { Action } from "../../../../dispatcher/actions";
import { Key } from "../../../../Keyboard";

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
import GlobalSocketManager from "../../rooms/Calling/GlobalSocketManager";
import CallModal from "../Calling/CallModal";
import { VideoRoom } from "../livekit-calling/VideoRoom";
import LiveKitRoomManager from "../livekit-calling/LiveKitRoomManager";
import LegacyCallHandler, { AudioID } from "../../../../LegacyCallHandler";
import { showToast } from "../Calling/notificationUtils";
import CryptoJS from "crypto-js";
import { VideoRoomChatButton } from "./VideoRoomChatButton.tsx";
import { isVideoRoom as calcIsVideoRoom } from "../../../../utils/video-rooms.ts";
import { MainSplitContentType } from "../../../structures/RoomView.tsx";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";

// --- LOG CALL FUNCTION (AES-CBC, API POST) ---
export async function logCall(payload: Record<string, any>) {
    console.log("📞 logCall payload (before encryption):", payload);

    const apiKey =
        process.env.REACT_APP_MY_API_KEY || "dd567d9dc413ba272f5c418640a53c1ed89cce360b6e28af93f7c422dd0aaa16";
    const apiUrl = process.env.REACT_APP_CALL_LOG_API_URL || "https://bservices-api.org.pk/api/call-logs/";
    const rememberKey = localStorage.getItem("rememberKey") || "default-secret";

    // Hash key using SHA-256 and take first 16 bytes (32 hex chars) for AES key + IV
    const hashedKey = CryptoJS.SHA256(rememberKey).toString(); // 64 hex chars
    const shortHex = hashedKey.slice(0, 32); // 128-bit = 16 bytes = 32 hex chars
    const aesKey = CryptoJS.enc.Hex.parse(shortHex);
    const iv = CryptoJS.enc.Hex.parse(shortHex); // Same IV as key, as in Flutter

    // Inline AES encryption
    function encryptAES(value: string): string {
        const encrypted = CryptoJS.AES.encrypt(value, aesKey, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });
        return encrypted.toString(); // base64 output
    }

    const encryptedPayload: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
        if (key === "userId") {
            encryptedPayload[key] = value;
        } else if (typeof value === "boolean") {
            encryptedPayload[key] = value;
        } else if (Array.isArray(value)) {
            encryptedPayload[key] = value.map((item) =>
                item !== null && item !== undefined ? encryptAES(String(item)) : encryptAES(""),
            );
        } else if (value instanceof Date) {
            encryptedPayload[key] = encryptAES(value.toISOString());
        } else if (value === null || value === undefined) {
            encryptedPayload[key] = encryptAES("");
        } else {
            encryptedPayload[key] = encryptAES(String(value));
        }
    }

    console.log("🔐 logCall encryptedPayload:", encryptedPayload);

    const headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(encryptedPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Failed to post call log: ${response.status} ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log("✅ Call log API success:", data);
        return data;
    } catch (e) {
        console.error("🚨 logCall fetch error:", e);
    }
}

export default function RoomHeader({
    room,
    oobData,
    onSearchChange, // ← NEW
    onSearchCancel, // ← NEW
    focusRoomSearch, // ← NEW
}: {
    room: Room;
    additionalButtons?: ViewRoomOpts["buttons"];
    oobData?: IOOBData;
    onSearchChange?: (e: ChangeEvent) => void;
    onSearchCancel?: () => void;
    focusRoomSearch?: boolean;
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
    const [toUserIds, setToUserIds] = useState<string[]>([]);
    const [groupName, setGroupName] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.FocusMessageSearch) {
            setIsSearchOpen(true);
            // wait for open animation then focus
            setTimeout(() => searchInputRef.current?.focus(), 160);
        }
    });

    // If parent requests autofocus
    useEffect(() => {
        if (focusRoomSearch) {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 160);
        }
    }, [focusRoomSearch]);
    // Active call state for when user accepts an incoming call
    const [activeCallData, setActiveCallData] = useState<any>(null);

    const currentUser = room.getMember(client.getUserId() || "");
    const currentUserId = client.getUserId();
    const otherMember = members.filter((member) => member.userId !== currentUserId);

    // Handle incoming call acceptance
    const handleAcceptIncomingCall = useCallback(
        async (callData: any): Promise<void> => {
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

            // Send call picked up event to backend to notify other devices
            const socket = GlobalSocketManager.getInstance().getSocket();
            if (socket && callData.roomId && currentUserId) {
                const pickupData = {
                    roomId: callData.roomId,
                    userId: currentUserId,
                    timestamp: new Date().toISOString(),
                };

                console.log("📤 RoomHeader emitting call_picked_up event:", pickupData);
                socket.emit("call_picked_up", pickupData);
            } else {
                console.warn("❌ Cannot emit call_picked_up from RoomHeader - socket, roomId, or userId not available");
            }

            // Log answered call (not missed)
            const now = new Date().toISOString();
            await logCall({
                userRecords: [
                    {
                        userId: currentUserId,
                        name: [currentUserId],
                        imageUrl: [null],
                        isIncoming: false,
                        isMissedCall: false,
                        userCalledId: toUserIds,
                    },
                    ...toUserIds.map((id) => ({
                        userId: id,
                        name: [id],
                        imageUrl: [null],
                        isIncoming: true,
                        isMissedCall: false,
                        userCalledId: [currentUserId],
                    })),
                ],
                isVideoCall: true,
                roomId: room.roomId,
                groupName: roomName,
            }).catch((e) => console.error("logCall error", e));
        },
        [currentUserId],
    );
    const saveUserIdsAndGroupNameToLocalStorage = (toUserIds: string[], groupName: string | null) => {
        const callDataForStorage = {
            toUserIds,
            groupName,
        };

        // Save to localStorage
        localStorage.setItem("activeCallData", JSON.stringify(callDataForStorage));
        // console.log("✅ Saved userIds and groupName to localStorage:", callDataForStorage);
    };

    useEffect(() => {
        // Function to gather and save participant data
        const gatherAndSaveParticipantData = (): void => {
            try {
                const currentUserId = client.getUserId();
                if (!currentUserId) {
                    console.error("❌ Current user ID not available");
                    return;
                }

                // Get room members excluding the current user
                const otherUsers = members.filter((member) => member.userId !== currentUserId);
                if (otherUsers.length === 0) {
                    console.warn("⚠️ No other users found in room for calling");
                    return;
                }

                // Extract userIds
                const newToUserIds = otherUsers.map((member) => member.userId);

                // Determine if it's a group call (if there are multiple members)
                const isGroupCall = otherUsers.length > 1;
                const newGroupName = isGroupCall ? roomName : null;

                // Update state with the new userIds and groupName
                setToUserIds(newToUserIds);
                setGroupName(newGroupName);

                // Save the userIds and groupName to localStorage
                saveUserIdsAndGroupNameToLocalStorage(newToUserIds, newGroupName);
            } catch (error) {
                console.error("❌ Error gathering participant data:", error);
            }
        };

        // Call the function immediately to update the local storage with current data
        gatherAndSaveParticipantData();

        // Set an interval to refresh the localStorage and UI every 5 seconds (adjustable)
        const intervalId = setInterval(() => {
            gatherAndSaveParticipantData();
        }, 500); // Update every 5 seconds

        // Cleanup the interval on component unmount or dependency change
        return () => {
            clearInterval(intervalId);
        };
    }, [room, members, roomName, client.getUserId()]);
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

            // Send rejection response to backend using global socket
            const socket = GlobalSocketManager.getInstance().getSocket();
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

    // The socket is now managed globally, no need to initialize in component
    useEffect(() => {
        // Socket connection is managed by GlobalSocketManager at app level
        // Check if socket is available
        const socket = GlobalSocketManager.getInstance().getSocket();
        if (socket) {
            console.log("✅ Global socket available in RoomHeader:", socket.connected ? "connected" : "disconnected");
        } else {
            console.warn("⚠️ Global socket not yet available in RoomHeader");
        }

        // REMOVED: Incoming call handling is now done globally by GlobalSocketManager
        // This prevents duplicate event registration and notification issues

        // Note: incoming calls are now handled globally by GlobalSocketManager
        // But we still need to listen for when a call is accepted to show the UI
        const handleGlobalCallAccepted = (event: Event): void => {
            const customEvent = event as CustomEvent;
            const activeCall = customEvent.detail;

            console.log("✅ RoomHeader: Received global call accepted event", activeCall);
            console.log("🏠 Current room ID:", room.roomId);
            console.log("📞 Call room ID:", activeCall?.roomId);

            // Only handle calls for this room
            if (activeCall && activeCall.roomId === room.roomId) {
                console.log("📞 Setting up call UI for accepted call in this room");
                console.log("📞 Setting activeCallData to:", activeCall);
                setActiveCallData(activeCall);
                const now = new Date().toISOString();
                logCall({
                    userId: client.getUserId() || "",
                    name: [client.getUserId() || ""],
                    imageUrl: [null],
                    date: now,
                    isVideoCall: isLiveKitCallActive ? liveKitCallType === "video" : false,
                    roomId: room.roomId,
                    isIncoming: false,
                    isMissedCall: false, // Not missed
                    userCalledId: members
                        .filter((member) => member.userId !== client.getUserId())
                        .map((member) => member.userId),
                }).catch((e) => console.error("logCall error", e));
            } else {
                console.log("❌ Call is not for this room, ignoring");
            }
        };

        window.addEventListener("globalCallAccepted", handleGlobalCallAccepted);

        // NOTE: incomingLiveKitCall events are now handled globally by GlobalSocketManager

        // Note: Call declined handling is now centralized in GlobalSocketManager only
        // This prevents duplicate handlers and race conditions with state management

        // Listen for auto-timeout events to show appropriate message
        window.addEventListener("liveKitCallTimeout", async () => {
            console.log("📞 Received call timeout event");

            // Close any active call screen
            if (isLiveKitCallActive) {
                console.log("📞 Closing active LiveKit call due to timeout");
                closeLiveKitCall();
            }

            // Clear any outgoing call notifications
            if ((window as any).clearAllLiveKitCallNotifications) {
                (window as any).clearAllLiveKitCallNotifications();
            }

            // Show toast notification that no one answered
            showToast("No answer - call ended", "info", 3000);
            console.log("📞 Call timeout handled successfully");

            // Log missed call
            const now = new Date().toISOString();
            await logCall({
                userId: client.getUserId() || "",
                name: [client.getUserId() || ""],
                imageUrl: [null],
                date: now,
                isVideoCall: isLiveKitCallActive ? liveKitCallType === "video" : false,
                roomId: room.roomId,
                isIncoming: false,
                isMissedCall: false, // Missed call
                userCalledId: members
                    .filter((member) => member.userId !== client.getUserId())
                    .map((member) => member.userId),
            }).catch((e) => console.error("logCall error", e));
        });

        // Cleanup function
        return () => {
            window.removeEventListener("globalCallAccepted", handleGlobalCallAccepted);
            window.removeEventListener("liveKitCallTimeout", () => {});

            // Only clear outgoing call state when component actually unmounts (not during re-renders)
            // We can detect this by checking if the component is truly unmounting
            console.log("📞 RoomHeader useEffect cleanup - not clearing outgoing state during re-renders");
        };
    }, [handleAcceptIncomingCall, handleRejectIncomingCall, currentUserId, isLiveKitCallActive, room.roomId]);

    // Separate useEffect for component unmounting cleanup
    useEffect(() => {
        return () => {
            // This will only run when the component actually unmounts (no dependencies)
            console.log("📞 RoomHeader component unmounting - clearing outgoing call state");
            GlobalSocketManager.setGlobalOutgoingCallState(false);
        };
    }, []); // Empty dependency array ensures this only runs on mount/unmount

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

    // Modified group call functions to use LiveKit with proper participant data
    async function GroupCallVideo(): Promise<void> {
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

        // Set outgoing call state in GlobalSocketManager to track this device is making a call
        console.log("📞 GroupCallVideo: Setting outgoing call state to true for room:", participantData.roomId);
        GlobalSocketManager.setGlobalOutgoingCallState(true, participantData.roomId);
        console.log(
            "📞 GroupCallVideo: Outgoing call state set, current value:",
            GlobalSocketManager.isGlobalUserMakingCall(),
        );
    }

    async function GroupCallVoice(): Promise<void> {
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

        // Set outgoing call state in GlobalSocketManager to track this device is making a call
        console.log("📞 GroupCallVoice: Setting outgoing call state to true for room:", participantData.roomId);
        GlobalSocketManager.setGlobalOutgoingCallState(true, participantData.roomId);
        console.log(
            "📞 GroupCallVoice: Outgoing call state set, current value:",
            GlobalSocketManager.isGlobalUserMakingCall(),
        );
    }

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
                toUserIds: toUserIds,
                fromUsername: participantData.fromUsername,
                groupName: participantData.groupName,
                isVideoCall: true, // or false, depending on call type
                isIncoming: false, // or true, depending on context
                isMissedCall: false, // or true, depending on context
                userCalledId: toUserIds, // array of user IDs
            });

            return participantData;
        } catch (error) {
            console.error("❌ Error gathering participant data:", error);
            return null;
        }
    };

    // Function to close any active LiveKit call
    const closeLiveKitCall = (): void => {
        console.log("📞 closeLiveKitCall: Function called to close LiveKit call");
        console.log("📞 closeLiveKitCall: Current state:", {
            isLiveKitCallActive,
            hasLiveKitCallData: !!liveKitCallData,
            hasActiveCallData: !!activeCallData,
        });

        // Remove any existing LiveKit call notifications when closing call
        if ((window as any).clearAllLiveKitCallNotifications) {
            (window as any).clearAllLiveKitCallNotifications();
        } else {
            // Fallback if function not available yet
            document.querySelectorAll(".mx_LiveKitCallNotification").forEach((el) => el.remove());
        }
        console.log("🧹 Removed all existing LiveKit call notifications on call close");
        const now = new Date().toISOString();

        // Log call end
        logCall({
            userId: client.getUserId() || "",
            name: [client.getUserId() || ""],
            imageUrl: [null],
            date: now,
            isVideoCall: liveKitCallType === "video",
            roomId: room.roomId,
            isIncoming: false,
            isMissedCall: false, // Call was answered and then ended
            userCalledId: members
                .filter((member) => member.userId !== client.getUserId())
                .map((member) => member.userId),
        }).catch((e) => console.error("logCall error", e));

        console.log("📞 closeLiveKitCall: Setting call states to false/null");
        setIsLiveKitCallActive(false);
        setLiveKitCallData(null);
        setActiveCallData(null);

        // CRITICAL: Stop all media tracks to release mic/camera resources
        console.log("📞 closeLiveKitCall: Stopping all media tracks");
        try {
            // Method 1: Stop all media elements
            const mediaElements = document.querySelectorAll("video, audio");
            mediaElements.forEach((element) => {
                if (element.srcObject) {
                    const stream = element.srcObject as MediaStream;
                    stream.getTracks().forEach((track) => {
                        console.log("📞 Stopping track:", track.kind, track.label);
                        track.stop();
                    });
                    element.srcObject = null;
                }
            });

            // Method 2: Force stop any global media streams
            if ((window as any).__globalMediaStream) {
                console.log("📞 Stopping global media stream");
                const globalStream = (window as any).__globalMediaStream as MediaStream;
                globalStream.getTracks().forEach((track) => {
                    console.log("📞 Stopping global track:", track.kind);
                    track.stop();
                });
                delete (window as any).__globalMediaStream;
            }

            // Method 3: Dispatch custom event to force LiveKit room disconnect
            const disconnectEvent = new CustomEvent("forceLiveKitDisconnect", {
                detail: { reason: "call_declined" },
            });
            window.dispatchEvent(disconnectEvent);
            console.log("📞 Dispatched forceLiveKitDisconnect event");

            console.log("📞 All media tracks cleanup completed");
        } catch (error) {
            console.warn("📞 Error releasing media resources:", error);
        }

        // Clear outgoing call state in GlobalSocketManager since call is ending
        GlobalSocketManager.setGlobalOutgoingCallState(false);

        console.log("📞 closeLiveKitCall: Call closure completed successfully");
    };

    // Expose close function globally for direct access
    useEffect(() => {
        (window as any).globalCloseLiveKitCall = closeLiveKitCall;

        // Listen for force close events
        const handleForceClose = (event: Event) => {
            const customEvent = event as CustomEvent;
            console.log("📞 RoomHeader: Received forceCloseLiveKitCall event:", customEvent.detail);
            closeLiveKitCall();
        };

        window.addEventListener("forceCloseLiveKitCall", handleForceClose);

        return () => {
            delete (window as any).globalCloseLiveKitCall;
            window.removeEventListener("forceCloseLiveKitCall", handleForceClose);
        };
    }, []); // Empty dependency array since closeLiveKitCall doesn't change

    // Monitor activeCallData changes
    useEffect(() => {
        console.log("📞 activeCallData changed:", activeCallData);
        if (activeCallData) {
            console.log("✅ Active call data is set, LiveKitRoomManager should render");
        } else {
            console.log("❌ Active call data is null, no call UI should render");
        }
    }, [activeCallData]);

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

    const roomContext = useScopedRoomContext("mainSplitContentType");
    const isVideoRoom = calcIsVideoRoom(room);
    const showChatButton =
        isVideoRoom ||
        roomContext.mainSplitContentType === MainSplitContentType.MaximisedWidget ||
        roomContext.mainSplitContentType === MainSplitContentType.Call;

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
                                style={{ color: "black" }}
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


                    {/** INSERT THIS RIGHT BEFORE THE CALL BUTTONS **/}
                    <div className={classNames("mx_HeaderSearchWrap", { "mx_HeaderSearchWrap--open": isSearchOpen })}>
                        {isSearchOpen ? (
                            <Form.Root className="mx_HeaderSearchForm" onSubmit={(e) => e.preventDefault()}>
                                <Search
                                    placeholder={_t("room|search|placeholder")}
                                    name="room_message_search"
                                    className="mx_HeaderSearchInput mx_no_textinput"
                                    ref={searchInputRef}
                                    onChange={onSearchChange}
                                    onBlur={() => {
                                        // Collapse if empty on blur
                                        if (!searchInputRef.current?.value) setIsSearchOpen(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === Key.ESCAPE && searchInputRef.current) {
                                            searchInputRef.current.value = "";
                                            onSearchCancel?.();
                                            setIsSearchOpen(false);
                                        }
                                    }}
                                />
                            </Form.Root>
                        ) : (
                            <IconButton
                                aria-label={_t("room|search|open")}
                                onClick={() => {
                                    setIsSearchOpen(true);
                                    setTimeout(() => searchInputRef.current?.focus(), 160);
                                }}
                                className="mx_HeaderSearchButton"
                            >
                                <SearchIcon />
                            </IconButton>
                        )}
                    </div>

                    {!showChatButton && (
                        <>
                            
                                <button
                                    style={{
                                        background: "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)",
                                        border: "none",
                                        borderRadius: "40px",
                                        height: "40px",
                                        width: "170px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#fff",
                                        fontWeight: 600,
                                        fontSize: "14px",
                                        fontFamily:
                                            "'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                                    }}
                                    onClick={() => window.open("https://beep.gov.pk", "_blank")}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = "linear-gradient(135deg, #4CAF50, #2E7D32)";
                                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(72, 141, 65, 0.7)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background =
                                            "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                    }}
                                    onMouseDown={(e) => {
                                        e.currentTarget.style.transform = "scale(0.97)";
                                    }}
                                    onMouseUp={(e) => {
                                        e.currentTarget.style.transform = "scale(1)";
                                    }}
                                >
                                    Public Conference
                                </button>
                            
                                <button
  onClick={GroupCallVoice}
  disabled={isLiveKitCallActive || !!activeCallData}
  title={isLiveKitCallActive || activeCallData ? "Call in progress" : "Start voice call"}
  style={{
    background: "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)",
    border: "none",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: isLiveKitCallActive || activeCallData ? "not-allowed" : "pointer",
    opacity: isLiveKitCallActive || activeCallData ? 0.5 : 1,
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
  }}
  onMouseOver={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.background = "linear-gradient(135deg, #4CAF50, #2E7D32)";
      e.currentTarget.style.boxShadow = "0 6px 16px rgba(72, 141, 65, 0.7)";
      e.currentTarget.style.transform = "translateY(-2px)";
    }
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.background = "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)";
    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    e.currentTarget.style.transform = "translateY(0)";
  }}
  onMouseDown={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.transform = "scale(0.95)";
    }
  }}
  onMouseUp={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.transform = "scale(1)";
    }
  }}
>
  <VoiceCallIcon style={{ fontSize: "20px", color: "#fff" }} />
</button>

<button
  onClick={GroupCallVideo}
  disabled={isLiveKitCallActive || !!activeCallData}
  title={isLiveKitCallActive || activeCallData ? "Call in progress" : "Start video call"}
  style={{
    background: "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)",
    border: "none",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: isLiveKitCallActive || activeCallData ? "not-allowed" : "pointer",
    opacity: isLiveKitCallActive || activeCallData ? 0.5 : 1,
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
  }}
  onMouseOver={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.background = "linear-gradient(135deg, #4CAF50, #2E7D32)";
      e.currentTarget.style.boxShadow = "0 6px 16px rgba(72, 141, 65, 0.7)";
      e.currentTarget.style.transform = "translateY(-2px)";
    }
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.background = "linear-gradient(135deg, rgb(72, 141, 65), #1B5E20)";
    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    e.currentTarget.style.transform = "translateY(0)";
  }}
  onMouseDown={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.transform = "scale(0.95)";
    }
  }}
  onMouseUp={(e) => {
    if (!(isLiveKitCallActive || activeCallData)) {
      e.currentTarget.style.transform = "scale(1)";
    }
  }}
>
  <VideoCallIcon style={{ fontSize: "20px", color: "#fff" }} />
</button>

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
                    {showChatButton && <VideoRoomChatButton room={room} />}

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
                    {/* FacePile (Member List) - hide if restricted */}
                    {((!isDirectMessage && !allSamePowerLevel) || memberCount === 1 || memberCount === 0) && (
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
