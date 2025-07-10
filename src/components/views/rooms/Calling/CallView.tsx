import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Box } from "../../../utils/Box";
import { Flex } from "../../../utils/Flex";
import { _t } from "../../../../languageHandler";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { AudioMutedOutlined, AudioOutlined, VideoCameraOutlined, VideoCameraAddOutlined, PhoneOutlined } from '@ant-design/icons';

interface CallViewProps {
    onEndCall: () => void;
}

const CallView: React.FC<CallViewProps> = ({ onEndCall }) => {
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // Get call state from Redux
    const {
        localStream,
        remoteStreams,
        participants,
        isVideo
    } = useSelector((state: any) => state.call);

    // Effect to handle local stream
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(error => {
                console.error('Error playing local stream:', error);
            });
        }
    }, [localStream]);

    // Effect to handle remote streams
    useEffect(() => {
        Object.entries(remoteStreams).forEach(([userId, stream]) => {
            const videoRef = remoteVideoRefs.current[userId];
            if (stream && videoRef) {
                videoRef.srcObject = stream as MediaStream;
                videoRef.play().catch(error => {
                    console.error('Error playing remote stream:', error);
                });
            }
        });
    }, [remoteStreams]);

    // Handle toggling audio
    const handleToggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    // Handle toggling video
    const handleToggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    // Video participant component
    const VideoParticipant = ({ stream, isLocal, userId }: { stream: MediaStream, isLocal: boolean, userId: string }) => {
        const username = isLocal ? 'You' : (participants[userId]?.username || 'Remote User');
        
        return (
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
                <video
                    ref={isLocal ? localVideoRef : (el) => remoteVideoRefs.current[userId] = el}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-white">{username}</span>
                        {isLocal && (
                            <div className="flex gap-2">
                                <IconButton
                                    onClick={handleToggleAudio}
                                    className={`p-2 rounded-lg transition-all ${
                                        isAudioEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 text-white'
                                    }`}
                                >
                                    {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                                </IconButton>
                                {isVideo && (
                                    <IconButton
                                        onClick={handleToggleVideo}
                                        className={`p-2 rounded-lg transition-all ${
                                            isVideoEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 text-white'
                                        }`}
                                    >
                                        {isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                                    </IconButton>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Audio participant component
    const AudioParticipant = ({ userId }: { userId: string }) => {
        const username = userId === 'local' ? 'You' : (participants[userId]?.username || 'Remote User');
        
        return (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl shadow-sm">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center">
                    <span className="text-2xl text-gray-700">{username[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{username}</span>
                {userId === 'local' && (
                    <IconButton
                        onClick={handleToggleAudio}
                        className={`mt-2 ${isAudioEnabled ? 'bg-gray-100' : 'bg-red-500 text-white'}`}
                    >
                        {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                    </IconButton>
                )}
            </div>
        );
    };

    return (
        <Box className="p-6 bg-gray-100 min-h-[400px]">
            {isVideo ? (
                // Video call layout
                <div className={`grid ${
                    Object.keys(remoteStreams).length === 0 ? 'grid-cols-1' :
                    Object.keys(remoteStreams).length === 1 ? 'grid-cols-2' :
                    'grid-cols-2 lg:grid-cols-3'
                } gap-4 mb-6`}>
                    {localStream && (
                        <VideoParticipant
                            stream={localStream}
                            isLocal={true}
                            userId="local"
                        />
                    )}
                    {Object.entries(remoteStreams).map(([userId, stream]) => (
                        <VideoParticipant
                            key={userId}
                            stream={stream as MediaStream}
                            isLocal={false}
                            userId={userId}
                        />
                    ))}
                </div>
            ) : (
                // Audio call layout
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <AudioParticipant userId="local" />
                    {Object.keys(remoteStreams).map((userId) => (
                        <AudioParticipant key={userId} userId={userId} />
                    ))}
                </div>
            )}

            {/* Call controls */}
            <div className="flex justify-center mt-6">
                <button
                    onClick={onEndCall}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-red-500 hover:bg-red-600 transition-colors text-white"
                >
                    <PhoneOutlined rotate={135} />
                    <span>End Call</span>
                </button>
            </div>
        </Box>
    );
};

export default CallView; 