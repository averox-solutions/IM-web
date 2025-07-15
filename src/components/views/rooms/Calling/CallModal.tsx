/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useEffect, useState } from "react";
import {
    UserOutlined,
    AudioOutlined,
    AudioMutedOutlined,
    VideoCameraOutlined,
    VideoCameraAddOutlined,
    PhoneOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
} from "./Icons";
import { useSelector, useDispatch } from "react-redux";
import { setOngoingCall } from "./redux/callReducer";
import CallService from "./callService";
import AudioService from "./audioService";
import "./CallModal.css";
import { setIncomingCall } from "./redux/callReducer";
import { initializeSocketIfNeeded } from "./socketInitializer";
import CustomModal from "./CustomModal";
import CustomTooltip from "./CustomTooltip";
import "./CustomModal.css";
import "./CustomTooltip.css";
import { db } from "../../../../Firebase";
import { collection, addDoc } from "firebase/firestore";
import store from "./redux/store";

type CallLogStatus = "missed" | "declined" | "accepted" | "ended";

interface MediaStreamWithTracks extends MediaStream {
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
}

interface CallState {
    isIncoming: boolean;
    isOngoing: boolean;
    roomId: string | null;
    isVideo: boolean;
    localStream: MediaStream | null;
    remoteStreams: { [key: string]: MediaStream | null };
    participants: { [key: string]: { id: string; username: string } };
    callerInfo?: {
        username: string;
        isGroupCall: boolean;
        groupName?: string;
    };
    userId: string;
    callLogId?: string;
}

const VideoRenderer: React.FC<{
    stream: MediaStream | null;
    muted?: boolean;
    mirrored?: boolean;
    className?: string;
    onStreamAttached?: () => void;
}> = ({ stream, muted = false, mirrored = false, className = "", onStreamAttached }) => {
    const [attached, setAttached] = useState(false);
    const [attachError, setAttachError] = useState<string | null>(null);
    const videoElementRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let attachTimeout: ReturnType<typeof setTimeout>;
        let attempts = 0;
        const maxAttempts = 5;

        const tryAttachStream = () => {
            const videoElement = videoElementRef.current;
            if (!videoElement || !stream) {
                if (attempts < maxAttempts) {
                    attempts++;
                    attachTimeout = setTimeout(tryAttachStream, 200);
                }
                return;
            }

            try {
                if (videoElement.srcObject !== stream) {
                    if (videoElement.srcObject) {
                        try {
                            const oldStream = videoElement.srcObject as MediaStream;
                            oldStream.getTracks().forEach((track) => track.stop());
                        } catch (err) {
                            console.warn("Error cleaning up old stream:", err);
                        }
                    }

                    console.log(`Attaching stream ${stream.id} to video element`);
                    videoElement.srcObject = stream;

                    videoElement
                        .play()
                        .then(() => {
                            console.log("Video started playing successfully");
                            setAttached(true);
                            setAttachError(null);
                            if (onStreamAttached) onStreamAttached();
                        })
                        .catch((err) => {
                            console.error("Error playing video:", err);
                            setAttachError(`Play error: ${err.message}`);

                            setTimeout(() => {
                                if (videoElement && videoElement.paused) {
                                    videoElement.play().catch((e) => {
                                        console.error("Retry play failed:", e);
                                    });
                                }
                            }, 500);
                        });
                }
            } catch (err) {
                console.error("Error attaching stream to video element:", err);
                setAttachError(`Attach error: ${err instanceof Error ? err.message : String(err)}`);

                if (attempts < maxAttempts) {
                    attempts++;
                    attachTimeout = setTimeout(tryAttachStream, 200);
                }
            }
        };

        tryAttachStream();

        return () => {
            clearTimeout(attachTimeout);
            if (videoElementRef.current) {
                videoElementRef.current.srcObject = null;
            }
        };
    }, [stream, onStreamAttached]);

    return (
        <div className={`video-renderer ${className}`}>
            <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted={muted}
                style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
            />

            {process.env.NODE_ENV !== "production" && (
                <div className="absolute top-2 left-2 p-2 bg-black/70 text-xs text-white rounded">
                    {stream ? (
                        <>
                            <div>Stream: {stream.id.substring(0, 8)}...</div>
                            <div>Attached: {attached ? "Yes" : "No"}</div>
                            {attachError && <div style={{ color: "#ff6b6b" }}>{attachError}</div>}
                        </>
                    ) : (
                        <div>No stream</div>
                    )}
                </div>
            )}

            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <span>No video available</span>
                </div>
            )}
        </div>
    );
};

const CallModal: React.FC = () => {
    const dispatch = useDispatch();
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [localStreamAttached, setLocalStreamAttached] = useState(false);
    const [socketInitialized, setSocketInitialized] = useState(false);

    const { isIncoming, isOngoing, roomId, isVideo, localStream, remoteStreams, participants, callerInfo } =
        useSelector((state: any) => state.call);

    console.log("incomming call data", isIncoming);

    const incomingCallUrl =
        "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e";
    const outgoingCallUrl =
        "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685";

    // console.log('localStream in call modal', localStream);

    // References for audio elements
    const remoteAudioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

    // Initialize socket when component mounts, especially important for incoming calls
    useEffect(() => {
        const initSocket = async () => {
            try {
                const socket = initializeSocketIfNeeded();
                if (socket) {
                    setSocketInitialized(true);
                    console.log("Socket initialized in CallModal");
                } else {
                    console.error("Failed to initialize socket in CallModal");
                }
            } catch (error) {
                console.error("Error initializing socket:", error);
            }
        };

        initSocket();
    }, []);

    const logCallEvent = async (status: CallLogStatus) => {
        if (!callerInfo || !roomId) return;

        const otherUser = callerInfo.username || "Unknown";
        const role = isIncoming ? "receiver" : "caller";

        const entry = {
            type: isVideo ? "video" : "voice",
            status,
            timestamp: new Date().toISOString(),
            participants: Object.keys(participants),
            otherUser,
            role,
            roomId,
            isGroup: callerInfo.isGroupCall || false,
        };

        try {
            await addDoc(collection(db, "call_logs"), entry); // Creates doc if missing
            console.log("[📞 Call Logged]", status.toUpperCase(), entry);
        } catch (err) {
            console.error("Failed to log call event:", err);
        }
    };
    // Effect to reset audio references when call state changes
    useEffect(() => {
        console.log("useEffect isOngoing", isOngoing);
        // When a call ends or a new call starts, reset the audio references
        if (!isOngoing) {
            // Reset all remote audio references
            Object.keys(remoteAudioRefs.current).forEach((userId) => {
                const audioRef = remoteAudioRefs.current[userId];
                if (audioRef) {
                    audioRef.srcObject = null;
                }
            });

            // Reset state
            setPermissionGranted(false);
            setLocalStreamAttached(false);
        }
    }, [isOngoing]);

    // Handle remote streams
    useEffect(() => {
        console.log("useEffect ran 3");
        if (!permissionGranted && !isIncoming) return;

        Object.entries(remoteStreams).forEach(([userId, stream]) => {
            // Stop any playing sounds when we get a remote stream
            AudioService.stopAll();

            // Handle audio
            const audioElement = remoteAudioRefs.current[userId];
            if (audioElement && stream) {
                const typedStream = stream as MediaStreamWithTracks;
                const audioTracks = typedStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    if (audioElement.srcObject !== stream) {
                        audioElement.srcObject = stream as MediaStream;
                        audioElement.play().catch((error) => {
                            console.error("Failed to play remote audio stream:", error);
                        });
                    }
                }
            }
        });
    }, [remoteStreams, permissionGranted, isIncoming, isVideo]);

    // Effect to handle permission granting for outgoing calls
    useEffect(() => {
        console.log("useEffect ran 4");
        if (!isIncoming && localStream && !permissionGranted) {
            setPermissionGranted(true);

            // If applicable, refresh remote streams
            if (isOngoing && roomId) {
                CallService.refreshRemoteStreams(roomId).catch((error) => {
                    console.error("Error refreshing remote streams after permission grant:", error);
                });
            }
        }
    }, [isIncoming, localStream, permissionGranted, isOngoing, roomId]);

    // Handle call sounds
    // Handle call sounds
    useEffect(() => {
        // Initialize audio service when component mounts
        AudioService.initialize();
        let audioPlayer: HTMLAudioElement | null = null;

        const handleSounds = () => {
            const hasRemoteParticipants = Object.values(remoteStreams).filter((stream) => stream !== null).length > 0;

            // Stop any existing audio
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                audioPlayer = null;
            }

            // Handle incoming call sound
            if (isIncoming && !isOngoing) {
                audioPlayer = new Audio(incomingCallUrl);
                audioPlayer.loop = true;
                audioPlayer.play().catch((err) => console.error("Audio play failed:", err));
            }
            // Handle outgoing call sound
            else if (!isIncoming && isOngoing && !hasRemoteParticipants) {
                audioPlayer = new Audio(outgoingCallUrl);
                audioPlayer.loop = true;
                audioPlayer.play().catch((err) => console.error("Audio play failed:", err));
            }
            // Stop all sounds when call becomes ongoing with participants
            else if (hasRemoteParticipants) {
                AudioService.stopAll();
            }
        };

        handleSounds();

        return () => {
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
            AudioService.stopAll();
        };
    }, [isIncoming, isOngoing, participants, remoteStreams]);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const hasActiveStreams = Object.values(remoteStreams).filter((stream) => stream !== null).length > 0;

        if ((isIncoming && !isOngoing) || (!isIncoming && isOngoing && !hasActiveStreams)) {
            // If call is not answered within 30 seconds, handle timeout
            timeoutId = setTimeout(() => {
                if (roomId) {
                    CallService.handleCallTimeout(roomId);
                    logCallEvent("missed");
                }
            }, 30000); // 30 seconds
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isIncoming, isOngoing, roomId, remoteStreams]);

    // Handle accepting call
    const handleAcceptCall = async () => {
        if (!roomId) return;

        try {
            // Initialize socket connection if not already initialized
            const socket = initializeSocketIfNeeded();
            if (!socket) {
                throw new Error("Could not initialize socket connection");
            }

            // Request media permissions first
            await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: isVideo
                    ? {
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                          frameRate: { ideal: 30 },
                      }
                    : false,
            });

            setPermissionGranted(true);

            AudioService.stopAll();
            await logCallEvent("accepted");
            dispatch(setOngoingCall(true));
            dispatch(setIncomingCall(false));

            await CallService.acceptCall(roomId, isVideo);
        } catch (error) {
            console.error("Error accepting call:", error);

            // Handle permission denied error
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    // End the call since we can't proceed without permissions
                    handleEndCall();
                } else {
                    console.error("Unexpected error while accepting call:", error);
                    handleEndCall();
                }
            }
        }
    };

    // Handle ending call
    const handleEndCall = async () => {
        if (roomId) {
            AudioService.playCallEnd();

            if (isIncoming && !isOngoing) {
                // For incoming calls that haven't been accepted yet, use declineCall
                const callState = store.getState().call;
                console.log("participants", participants);
                console.log("callState", callState.callerInfo?.username);
                // Get the current user's ID from the participants
                const currentUserId =
                    Object.keys(participants).find(
                        (id) => participants[id].username === callState.callerInfo?.username,
                    ) || "";
                // The other user would be the one who initiated the call
                const toUserId = Object.keys(participants).find((id) => id !== currentUserId) || "";

                await CallService.declineCall(
                    roomId,
                    currentUserId,
                    toUserId,
                    callState.callerInfo?.isGroupCall || false,
                );
                await logCallEvent("declined");
            } else {
                // For ongoing calls or outgoing calls, use endCall
                await CallService.endCall(roomId);
                await logCallEvent("ended");
            }

            setPermissionGranted(false);
        }
    };

    // Handle toggling audio
    const handleToggleAudio = () => {
        if (localStream) {
            const typedStream = localStream as MediaStreamWithTracks;
            const audioTrack = typedStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    // Handle toggling video
    const handleToggleVideo = () => {
        if (localStream) {
            const typedStream = localStream as MediaStreamWithTracks;
            const videoTrack = typedStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    // Get modal width based on number of streams
    const getModalWidth = () => {
        if (!isVideo) return 500;

        // Only count non-null streams
        const streamCount = Object.values(remoteStreams).filter((stream) => stream !== null).length;

        if (streamCount === 0) return 800;
        if (streamCount === 1) return 1000;
        return "90%";
    };

    if (!isIncoming && !isOngoing) return null;

    console.log("isVideo", isVideo);

    return (
        <CustomModal
            title={null}
            open={true}
            footer={null}
            closable={false}
            width={getModalWidth()}
            className="call-modal"
            centered
        >
            <div>
                {/* Call Header Information */}
                <div className="call-header">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Call Status */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-green-600 text-sm font-medium">
                                    {isIncoming ? "Incoming Call" : "Active Call"}
                                </span>
                            </div>

                            {/* Call Type */}
                            <div className="flex items-center gap-2 text-gray-500">
                                <span className="text-sm">•</span>
                                <span className="text-sm">{isVideo ? "Video Call" : "Audio Call"}</span>
                            </div>
                        </div>

                        {/* Participants Count */}
                        {isOngoing && (
                            <div className="flex items-center gap-2">
                                <CustomTooltip title="Participants in call">
                                    <div className="flex items-center gap-2">
                                        <UserOutlined className="text-gray-500" />
                                        <span className="text-sm text-gray-500">
                                            {Object.values(remoteStreams).filter((stream) => stream !== null).length +
                                                1}
                                        </span>
                                    </div>
                                </CustomTooltip>
                            </div>
                        )}
                    </div>

                    {/* Caller Info */}
                    {callerInfo && (
                        <div className="mt-2">
                            <h3 className="text-lg font-medium text-gray-900">
                                {callerInfo.isGroupCall ? callerInfo.groupName : callerInfo.username}
                            </h3>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="call-content">
                    {/* Debug info - development only */}
                    {process.env.NODE_ENV !== "production" && (
                        <div className="debug-panel">
                            <div>localStream: {localStream ? "Available" : "Not available"}</div>
                            <div>Video tracks: {localStream?.getVideoTracks().length || 0}</div>
                            <div>Audio tracks: {localStream?.getAudioTracks().length || 0}</div>
                            <div>permissionGranted: {permissionGranted ? "Yes" : "No"}</div>
                            <div>socketInitialized: {socketInitialized ? "Yes" : "No"}</div>
                            <div>isOngoing: {isOngoing ? "Yes" : "No"}</div>
                            <div>isVideo: {isVideo ? "Yes" : "No"}</div>
                            <div>remoteStreams count: {Object.keys(remoteStreams).length}</div>
                            <div>localStreamAttached: {localStreamAttached ? "Yes" : "No"}</div>
                        </div>
                    )}

                    {/* Video Grid */}
                    {isVideo ? (
                        <div>
                            <div
                                className={`video-grid ${
                                    Object.keys(remoteStreams).length === 0
                                        ? "video-grid-1"
                                        : Object.keys(remoteStreams).length === 1
                                          ? "video-grid-2"
                                          : "video-grid-3"
                                }`}
                            >
                                {/* Local Video */}
                                <div className="video-container">
                                    {/* Self-contained video renderer */}
                                    <VideoRenderer
                                        stream={localStream}
                                        muted={true}
                                        mirrored={true}
                                        onStreamAttached={() => setLocalStreamAttached(true)}
                                    />
                                    <div className="video-controls">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-white">You</span>
                                            <div className="flex gap-2">
                                                <CustomTooltip
                                                    title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                                                >
                                                    <button
                                                        className={`p-2 rounded-lg transition-all ${
                                                            isAudioEnabled
                                                                ? "bg-white/20 hover:bg-white/30"
                                                                : "bg-red-500 text-white"
                                                        }`}
                                                        onClick={handleToggleAudio}
                                                    >
                                                        {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                                                    </button>
                                                </CustomTooltip>
                                                <CustomTooltip
                                                    title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                                                >
                                                    <button
                                                        className={`p-2 rounded-lg transition-all ${
                                                            isVideoEnabled
                                                                ? "bg-white/20 hover:bg-white/30"
                                                                : "bg-red-500 text-white"
                                                        }`}
                                                        onClick={handleToggleVideo}
                                                    >
                                                        {isVideoEnabled ? (
                                                            <VideoCameraOutlined />
                                                        ) : (
                                                            <VideoCameraAddOutlined />
                                                        )}
                                                    </button>
                                                </CustomTooltip>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Remote Videos */}
                                {Object.entries(remoteStreams)
                                    .filter(([_, stream]) => stream !== null)
                                    .map(([userId, stream]) => {
                                        console.log("userId", userId);
                                        console.log("participant", participants);
                                        const participant = participants[userId];
                                        return (
                                            <div key={userId} className="video-container">
                                                {/* Self-contained video renderer */}
                                                <VideoRenderer
                                                    stream={stream as MediaStream}
                                                    muted={false}
                                                    mirrored={false}
                                                />
                                                <audio
                                                    ref={(el) => {
                                                        remoteAudioRefs.current[userId] = el;
                                                    }}
                                                    autoPlay
                                                />
                                                <div className="video-controls">
                                                    <span className="text-sm font-medium text-white">
                                                        {participant?.username || "Remote User"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ) : (
                        /* Audio Call View */
                        <div className="flex flex-col items-center justify-center h-full">
                            {/* Add audio elements for remote streams */}
                            {Object.entries(remoteStreams).map(([userId]) => {
                                return (
                                    <audio
                                        key={userId}
                                        ref={(el) => {
                                            remoteAudioRefs.current[userId] = el;
                                        }}
                                        autoPlay
                                    />
                                );
                            })}
                            <div className="audio-grid">
                                {/* Show current user first */}
                                <div className="audio-participant">
                                    <div className="relative">
                                        <div className="audio-avatar">
                                            <UserOutlined className="text-2xl text-gray-700" />
                                        </div>
                                        {/* Audio control for current user */}
                                        <CustomTooltip title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}>
                                            <button
                                                onClick={handleToggleAudio}
                                                className={`audio-controls ${
                                                    isAudioEnabled
                                                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                        : "bg-red-500 hover:bg-red-600 text-white"
                                                }`}
                                            >
                                                {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                                            </button>
                                        </CustomTooltip>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">You</span>
                                </div>

                                {/* Show remote participants */}
                                {Object.entries(remoteStreams)
                                    .filter(([_, stream]) => stream !== null)
                                    .map(([userId, stream]) => {
                                        const participant = participants[userId];
                                        if (!participant) return null;

                                        const typedStream = stream as MediaStreamWithTracks;
                                        return (
                                            <div key={userId} className="audio-participant">
                                                <div className="relative">
                                                    <div className="audio-avatar">
                                                        <UserOutlined className="text-2xl text-gray-700" />
                                                    </div>
                                                    {/* Show mute status for remote participants */}
                                                    {typedStream.getAudioTracks()[0]?.enabled === false && (
                                                        <div className="audio-controls bg-red-500 text-white">
                                                            <AudioMutedOutlined />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {participant.username}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Call Controls */}
                    {isOngoing && !isIncoming && (
                        <div className="call-actions">
                            <button className="call-button decline-button" onClick={handleEndCall}>
                                <PhoneOutlined rotate={135} />
                                <span>Leave Call</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Incoming Call Actions */}
                {isIncoming && (
                    <div className="border-t border-gray-100 p-6">
                        <div className="call-actions">
                            <button className="call-button accept-button" onClick={handleAcceptCall}>
                                <CheckCircleFilled />
                                <span>Accept</span>
                            </button>
                            <button className="call-button decline-button" onClick={handleEndCall}>
                                <CloseCircleFilled />
                                <span>Decline</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </CustomModal>
    );
};

export default CallModal;
