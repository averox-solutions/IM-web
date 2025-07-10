import { useAppSelector, useAppDispatch } from '../redux/hooks';
import {
  setOngoingCall,
  setLocalStream,
  resetCallState
} from '../redux/callReducer';
import CallService from '../callService';
import { useCallback } from 'react';

/**
 * Custom hook to access call state and actions
 */
export function useCallState() {
  const dispatch = useAppDispatch();
  const callState = useAppSelector(state => state.call);
  
  // Callback to start a call
  const startCall = useCallback(async (
    roomId: string,
    toUserIds: string[],
    isVideo: boolean,
    fromUsername: string,
    toUsernames: { [key: string]: string },
    groupName?: string,
    chatId?: string
  ) => {
    try {
      console.log('Starting call with socket.io and mediasoup... 2');
      await CallService.startCall(
        roomId,
        toUserIds,
        isVideo,
        fromUsername,
        toUsernames,
        groupName,
        chatId
      );
      return true;
    } catch (error) {
      console.error('Error starting call:', error);
      return false;
    }
  }, []);
  
  // Callback to end a call
  const endCall = useCallback(async (roomId: string, isRejected: boolean = false) => {
    try {
      await CallService.endCall(roomId, isRejected);
      return true;
    } catch (error) {
      console.error('Error ending call:', error);
      return false;
    }
  }, []);
  
  // Callback to accept a call
  const acceptCall = useCallback(async (roomId: string, isVideo: boolean) => {
    try {
      await CallService.acceptCall(roomId, isVideo);
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      return false;
    }
  }, []);
  
  return {
    // State
    isOngoing: callState.isOngoing,
    localStream: callState.localStream,
    remoteStreams: callState.remoteStreams,
    isIncoming: callState.isIncoming,
    roomId: callState.roomId,
    callLogId: callState.callLogId,
    callerInfo: callState.callerInfo,
    
    // Actions
    startCall,
    endCall,
    acceptCall,
    
    // Direct dispatch actions
    setOngoingCall: (isOngoing: boolean) => dispatch(setOngoingCall(isOngoing)),
    setLocalStream: (stream: MediaStream | null) => dispatch(setLocalStream(stream)),
    resetCallState: () => dispatch(resetCallState())
  };
} 