import { combineReducers } from '@reduxjs/toolkit';
import callReducer from './callReducer';
import socketReducer from './socketReducer';

// Combine all reducers
const rootReducer = combineReducers({
  call: callReducer,
  socket: socketReducer,
});

// Define root state type
export type RootState = ReturnType<typeof rootReducer>;

export default rootReducer; 