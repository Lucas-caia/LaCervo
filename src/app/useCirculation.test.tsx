import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { sessionChanged, store } from './store';
import { useReaderLibrary } from './useCirculation';
import { subscribeReaderLibrary, type ReaderLibrary } from '../services/circulation';

jest.mock('../services/circulation', () => ({ subscribeReaderLibrary: jest.fn(), subscribeCopy: jest.fn(), circulationError: (error: Error) => error.message }));
const subscribe = jest.mocked(subscribeReaderLibrary);
const subscriptions: { next: (data: ReaderLibrary) => void; error: (error: Error) => void; stop: ReturnType<typeof jest.fn> }[] = [];
const empty: ReaderLibrary = { loans: [], reservations: [], progress: [] };
const loaded: ReaderLibrary = { ...empty, progress: [{ userId: 'alice', workId: 'OL1W', status: 'reading' }] };
function wrapper({ children }: { children: ReactNode }) { return <Provider store={store}>{children}</Provider>; }
const login = (uid: string | null) => store.dispatch(sessionChanged(uid ? { uid, email: null, displayName: null } : null));
beforeEach(() => {
  jest.resetAllMocks(); subscriptions.length = 0; login('alice');
  subscribe.mockImplementation((_uid, next, error) => { const stop = jest.fn(); subscriptions.push({ next, error, stop }); return stop; });
});

describe('reader library hook', () => {
  it('does not request private data for a guest', () => {
    login(null); const { result } = renderHook(useReaderLibrary, { wrapper });
    expect(result.current.loading).toBe(false); expect(result.current.data).toEqual(empty); expect(subscribe).not.toHaveBeenCalled();
  });
  it('exposes loading followed by returned data, including an empty library', () => {
    const { result } = renderHook(useReaderLibrary, { wrapper }); expect(result.current.loading).toBe(true);
    act(() => subscriptions[0].next(loaded)); expect(result.current.loading).toBe(false); expect(result.current.data.progress).toHaveLength(1);
    act(() => subscriptions[0].next(empty)); expect(result.current.data).toEqual(empty); expect(result.current.error).toBe('');
  });
  it('reports an error, retries and ignores an old subscription response', () => {
    const { result } = renderHook(useReaderLibrary, { wrapper });
    act(() => subscriptions[0].error(new Error('Sem conexão'))); expect(result.current.error).toBe('Sem conexão');
    act(() => result.current.retry()); expect(subscriptions[0].stop).toHaveBeenCalled(); expect(result.current.loading).toBe(true);
    act(() => subscriptions[0].next(loaded)); expect(result.current.data).toEqual(empty);
    act(() => subscriptions[1].next(loaded)); expect(result.current.error).toBe(''); expect(result.current.loading).toBe(false);
  });
  it('clears data when switching accounts and stops listeners on logout and unmount', () => {
    const { result, unmount } = renderHook(useReaderLibrary, { wrapper });
    act(() => subscriptions[0].next(loaded));
    act(() => { login('bob'); }); expect(result.current.data).toEqual(empty); expect(result.current.loading).toBe(true);
    act(() => subscriptions[0].next(loaded)); expect(result.current.data).toEqual(empty);
    act(() => subscriptions[1].next(empty)); expect(result.current.loading).toBe(false);
    act(() => { login(null); }); expect(result.current.data).toEqual(empty); expect(subscriptions[1].stop).toHaveBeenCalled();
    act(() => { login('carol'); }); unmount(); expect(subscriptions[2].stop).toHaveBeenCalled();
  });
});
