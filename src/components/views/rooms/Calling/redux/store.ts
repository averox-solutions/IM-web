import { configureStore } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import rootReducer, { RootState } from './rootReducer';

const store = configureStore({
  reducer: rootReducer,
  middleware: undefined,
  devTools: {
    name: 'ElementWeb Calling',
    trace: true,
    traceLimit: 25,
  },
});

store.dispatch({ type: 'test/initialization', payload: { time: new Date().toISOString() } });

export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();

export type { RootState };

export default store; 