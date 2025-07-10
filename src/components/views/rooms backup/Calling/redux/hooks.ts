import { TypedUseSelectorHook, useSelector } from 'react-redux';
import { RootState } from './rootReducer';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector; 