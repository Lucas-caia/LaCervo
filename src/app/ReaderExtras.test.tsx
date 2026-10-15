import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { Provider } from 'react-redux';
import { ReaderExtrasProvider, useReaderExtras } from './ReaderExtras';
import { sessionChanged, store } from './store';
import type { AvailabilityNotice, WishItem } from '../domain/models';
import { digitalBooks } from '../test/fixtures';

const mockWishes = new Map<string, (rows: WishItem[]) => void>();
const mockNotices = new Map<string, (rows: AvailabilityNotice[]) => void>();
const mockStop = jest.fn();
jest.mock('../services/readerExtras', () => ({
  subscribeWishlist: (uid: string, next: (rows: WishItem[]) => void) => { mockWishes.set(uid, next); return mockStop; },
  subscribeNotices: (uid: string, next: (rows: AvailabilityNotice[]) => void) => { mockNotices.set(uid, next); return mockStop; },
  watchAvailability: () => mockStop
}));
function Probe() { const extras = useReaderExtras()!; return <p>{extras.wishes.map(item => item.book.title).join(',')}|{extras.notifications.length}</p>; }
beforeEach(() => { mockWishes.clear(); mockNotices.clear(); mockStop.mockClear(); store.dispatch(sessionChanged({ uid: 'alice', email: null, displayName: null })); });
it('clears private extras on account changes and ignores callbacks from the previous session', async () => {
  const view = render(<Provider store={store}><ReaderExtrasProvider><Probe /></ReaderExtrasProvider></Provider>);
  await waitFor(() => expect(mockWishes.has('alice')).toBe(true));
  const oldCallback = mockWishes.get('alice')!;
  const row: WishItem = { id: 'wish', userId: 'alice', workId: digitalBooks[0].id, book: digitalBooks[0], digital: true, createdAt: new Date().toISOString() };
  act(() => oldCallback([row])); expect(screen.getByText(`${row.book.title}|0`)).toBeInTheDocument();
  act(() => store.dispatch(sessionChanged({ uid: 'bob', email: null, displayName: null })));
  expect(screen.queryByText(`${row.book.title}|0`)).not.toBeInTheDocument();
  await waitFor(() => expect(mockWishes.has('bob')).toBe(true));
  act(() => oldCallback([row])); expect(screen.getByText('|0')).toBeInTheDocument();
  expect(mockStop).toHaveBeenCalled();
  act(() => store.dispatch(sessionChanged(null))); expect(screen.getByText('|0')).toBeInTheDocument();
  view.unmount();
});
