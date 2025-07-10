import { createAction } from '@reduxjs/toolkit';

// Socket connection actions
export const socketConnected = createAction('socket/connected');
export const socketDisconnected = createAction('socket/disconnected');
export const socketError = createAction<{ error: string }>('socket/error');
export const socketConnecting = createAction('socket/connecting');

// Socket event actions
export const socketEventReceived = createAction<{ 
  event: string; 
  data?: any; 
}>('socket/eventReceived');

// Test actions
export const testAction = createAction<{ message: string }>('test/action'); 