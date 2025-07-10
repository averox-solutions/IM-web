import React, { useEffect, useRef } from 'react';
import { useCallState } from '../hooks/useCallState';
import { showToast } from '../notificationUtils';

/**
 * Call UI component that displays the local and remote streams
 */
const CallUI: React.FC = () => {
  const {
    isOngoing,
    localStream,
    remoteStreams,
    callerInfo,
    roomId,
    isIncoming,
    endCall
  } = useCallState();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Connect local stream to video element when available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  // If no ongoing call, don't render anything
  if (!isOngoing) {
    return null;
  }
  
  // Handle ending the call
  const handleEndCall = () => {
    if (roomId) {
      endCall(roomId);
      showToast('Call ended', 'info');
    }
  };
  
  // Get remote video refs (not the most efficient, but simple for demo)
  const renderRemoteStreams = () => {
    return Object.entries(remoteStreams).map(([userId, stream]) => {
      if (!stream) return null;
      
      return (
        <div key={userId} className="remote-video-container">
          <video
            autoPlay
            playsInline
            ref={(element) => {
              if (element && stream) {
                element.srcObject = stream as MediaStream;
              }
            }}
            className="remote-video"
          />
          <div className="remote-user-id">{userId}</div>
        </div>
      );
    });
  };
  
  return (
    <div className="call-ui-container">
      <div className="call-header">
        <h3>{isIncoming ? 'Incoming Call' : 'Outgoing Call'}</h3>
        <div className="caller-info">
          {callerInfo && (
            <>
              <span>{callerInfo.username}</span>
              {callerInfo.isGroupCall && callerInfo.groupName && (
                <span> ({callerInfo.groupName})</span>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="video-container">
        <div className="local-video-container">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
          <div className="local-label">You</div>
        </div>
        
        <div className="remote-videos">
          {renderRemoteStreams()}
        </div>
      </div>
      
      <div className="call-controls">
        <button
          className="end-call-button"
          onClick={handleEndCall}
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default CallUI; 