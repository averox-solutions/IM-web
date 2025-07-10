import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the types for the call state
export interface CallState {
  isOngoing: boolean;
  localStream: MediaStream | null;
  remoteStreams: { [userId: string]: MediaStream | null };
  producers: { [kind: string]: any };
  consumers: { [id: string]: any };
  participants: { [userId: string]: { id: string; username: string } };
  isIncoming: boolean;
  roomId: string | null;
  callLogId: string | null;
  isVideo: boolean;
  callerInfo: {
    username: string;
    isGroupCall: boolean;
    groupName?: string;
  } | null;
}

// Define the initial state
const initialState: CallState = {
  isOngoing: false,
  localStream: null,
  remoteStreams: {},
  producers: {},
  consumers: {},
  participants: {},
  isIncoming: false,
  roomId: null,
  callLogId: null,
  isVideo: false,
  callerInfo: null
};

// Create a slice for call state
const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    // Set whether a call is ongoing
    setOngoingCall: (state, action: PayloadAction<boolean>) => {
      state.isOngoing = action.payload;
    },
    
    setIncomingCall: (state, action: PayloadAction<boolean>) => {
      state.isIncoming = action.payload;
    },
    // Set the local media stream
    setLocalStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.localStream = action.payload;
    },
    
    // Add a remote stream for a user
    addRemoteStream: (state, action: PayloadAction<{ userId: string; stream: MediaStream | null }>) => {
      const { userId, stream } = action.payload;
      state.remoteStreams[userId] = stream;
    },
    
    // Remove a remote stream for a user
    removeRemoteStream: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      delete state.remoteStreams[userId];
    },
    
    // Add a producer
    addProducer: (state, action: PayloadAction<{ kind: string; producer: any }>) => {
      const { kind, producer } = action.payload;
      state.producers[kind] = producer;
    },
    
    // Add a consumer
    addConsumer: (state, action: PayloadAction<{ id: string; consumer: any }>) => {
      const { id, consumer } = action.payload;
      state.consumers[id] = consumer;
    },
    
    // Remove a consumer
    removeConsumer: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.consumers[id];
    },
    
    // Set call room details
    setCallRoom: (state, action: PayloadAction<{
      roomId: string;
      userId: string;
      username: string;
      isVideo: boolean;
      isIncoming: boolean;
      participants: { [userId: string]: { id: string; username: string } };
      callLogId: string;
    }>) => {
      const { roomId, userId, username, isIncoming, isVideo, participants, callLogId } = action.payload;
      state.roomId = roomId;
      state.isIncoming = isIncoming;
      state.participants = participants;
      state.callLogId = callLogId;
      state.isVideo = isVideo;
    },
    
    // Set call info
    setCallInfo: (state, action: PayloadAction<{
      callerInfo: {
        username: string;
        isGroupCall: boolean;
        groupName?: string;
      };
      callLogId: string;
    }>) => {
      const { callerInfo, callLogId } = action.payload;
      state.callerInfo = callerInfo;
      state.callLogId = callLogId;
    },
    
    // Reset call state
    resetCallState: (state) => {
      state.isOngoing = false;
      state.localStream = null;
      state.remoteStreams = {};
      state.producers = {};
      state.consumers = {};
      state.isIncoming = false;
      state.roomId = null;
      state.callLogId = null;
      state.callerInfo = null;
      // Keep participants as they might be needed for history
    }
  }
});

// Export actions
export const {
  setOngoingCall,
  setLocalStream,
  setIncomingCall,
  addRemoteStream,
  removeRemoteStream,
  addProducer,
  addConsumer,
  removeConsumer,
  setCallRoom,
  setCallInfo,
  resetCallState
} = callSlice.actions;

// Export reducer
export default callSlice.reducer; 