import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { booksApi } from '../services/books';
import type { Reader } from '../domain/models';

interface AuthState { reader: Reader | null; ready: boolean; }
const sessionSlice = createSlice({
  name: 'session', initialState: { reader: null, ready: false } as AuthState,
  reducers: {
    sessionChanged(state, action: PayloadAction<Reader | null>) {
      state.reader = action.payload; state.ready = true;
    }
  }
});
export const { sessionChanged } = sessionSlice.actions;
export const store = configureStore({
  reducer: { session: sessionSlice.reducer, [booksApi.reducerPath]: booksApi.reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(booksApi.middleware)
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
