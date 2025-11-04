/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from 'react';
import { useCallState } from '../hooks/useCallState';
import { getCurrentMatrixUserId, getCurrentRoomInfo, getCurrentRoomMembers } from '../MatrixUtils';
import { showToast } from '../notificationUtils';
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";

interface MatrixCallButtonProps {
  isVideo?: boolean;
}

/**
 * A button component to start a call in a Matrix room
 */
const MatrixCallButton: React.FC<MatrixCallButtonProps> = ({ isVideo = false }) => {
  const { startCall, isOngoing } = useCallState();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleStartCall = async () => {
    // Don't start a new call if already in one
    if (isOngoing) {
      showToast('You are already in a call', 'warning');
      return;
    }
    
    setIsLoading(true);
    console.log("Starting call with socket.io and mediasoup...");
    
    try {
      // Get current room and user info
      const currentUserId = getCurrentMatrixUserId();
      const roomInfo = getCurrentRoomInfo();
      const roomMembers = getCurrentRoomMembers();
      
      console.log("Current user ID:", currentUserId);
      console.log("Room info:", roomInfo);
      console.log("Room members:", roomMembers);
      
      if (!currentUserId || !roomInfo) {
        showToast('Cannot start call: missing user or room information', 'error');
        return;
      }
      
      // Filter out current user from room members
      const otherMembers = roomMembers.filter(member => 
        member.userId !== currentUserId
      );
      
      console.log("Other members for call:", otherMembers);
      
      if (otherMembers.length === 0) {
        showToast('No other users in this room to call', 'warning');
        return;
      }
      
      // Map user IDs and names
      const toUserIds = otherMembers.map(member => member.userId);
      const toUsernames: { [key: string]: string } = {};
      otherMembers.forEach(member => {
        toUsernames[member.userId] = member.displayName;
      });
      
      console.log("Starting call with users:", toUserIds);
      console.log("User display names:", toUsernames);
      
      // Extract current user's display name
      const currentUserDisplayName = getCurrentMatrixUserId()?.replace(/^@/, '').split(':')[0] || '';
      
      console.log('matrix call btn startCall');
      // Start the call
      const result = await startCall(
        roomInfo.roomId,
        toUserIds,
        isVideo,
        currentUserDisplayName,
        toUsernames,
        roomInfo.roomName // Use room name as group name
      );
      
      if (result) {
        showToast(`${isVideo ? 'Video' : 'Audio'} call started`, 'success');
      } else {
        showToast('Failed to start call', 'error');
      }
    } catch (error) {
      console.error('Error starting call:', error);
      showToast('Error starting call', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const buttonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    color: '#737D8C',
    opacity: isLoading || isOngoing ? 0.5 : 1,
    pointerEvents: isLoading || isOngoing ? 'none' as const : 'auto' as const,
    height: '32px',
    width: '32px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  
  return (
    <button
      onClick={handleStartCall}
      disabled={isLoading || isOngoing}
      style={buttonStyle}
      title={isVideo ? 'Video Call' : 'Voice Call'}
    >
      {isVideo ? 
        <VideoCallIcon style={{ fontSize: "20px" }} /> : 
        <VoiceCallIcon style={{ fontSize: "20px" }} />
      }
    </button>
  );
};

export default MatrixCallButton; 