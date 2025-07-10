import { createReducer } from '@reduxjs/toolkit';
import { 
  socketConnected, 
  socketDisconnected, 
  socketError, 
  socketConnecting,
  socketEventReceived
} from './actions';

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastEvent: {
    name: string;
    data: any;
    timestamp: string;
  } | null;
  events: Array<{
    name: string;
    data: any;
    timestamp: string;
  }>;
}

const initialState: SocketState = {
  connected: false,
  connecting: false,
  error: null,
  lastEvent: null,
  events: []
};

const socketReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(socketConnected, (state) => {
      state.connected = true;
      state.connecting = false;
      state.error = null;
      state.lastEvent = {
        name: 'connect',
        data: null,
        timestamp: new Date().toISOString()
      };
      state.events.push(state.lastEvent);
    })
    .addCase(socketDisconnected, (state) => {
      state.connected = false;
      state.connecting = false;
      state.lastEvent = {
        name: 'disconnect',
        data: null,
        timestamp: new Date().toISOString()
      };
      state.events.push(state.lastEvent);
    })
    .addCase(socketConnecting, (state) => {
      state.connecting = true;
      state.lastEvent = {
        name: 'connecting',
        data: null,
        timestamp: new Date().toISOString()
      };
      state.events.push(state.lastEvent);
    })
    .addCase(socketError, (state, action) => {
      state.error = action.payload.error;
      state.connecting = false;
      state.connected = false;
      state.lastEvent = {
        name: 'error',
        data: action.payload,
        timestamp: new Date().toISOString()
      };
      state.events.push(state.lastEvent);
    })
    .addCase(socketEventReceived, (state, action) => {
      state.lastEvent = {
        name: action.payload.event,
        data: action.payload.data,
        timestamp: new Date().toISOString()
      };
      
      if (state.events.length >= 20) {
        state.events.shift();
      }
      state.events.push(state.lastEvent);
    });
});

export default socketReducer; 