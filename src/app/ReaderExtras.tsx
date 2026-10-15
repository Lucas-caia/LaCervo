import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAppSelector } from './store';
import type { AvailabilityNotice, WishItem } from '../domain/models';
import { circulationError } from '../services/errors';

interface Extras { uid: string | undefined; wishes: WishItem[]; notifications: AvailabilityNotice[]; wishLoading: boolean; noticeLoading: boolean; wishError: string; noticeError: string; retry: () => void; }
const Context = createContext<Extras | null>(null);
const empty = { uid: undefined as string | undefined, wishes: [] as WishItem[], notifications: [] as AvailabilityNotice[], wishLoading: false, noticeLoading: false, wishError: '', noticeError: '' };
export const useReaderExtras = () => useContext(Context);
export function ReaderExtrasProvider({ children }: { children: ReactNode }) {
  const uid = useAppSelector(state => state.session.reader?.uid);
  const [state, setState] = useState(empty), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState({ ...empty, uid, wishLoading: Boolean(uid), noticeLoading: Boolean(uid) });
    if (!uid) return;
    let active = true;
    let stopWishes = () => {}, stopNotices = () => {};
    void import('../services/readerExtras').then(({ subscribeWishlist, subscribeNotices }) => {
      if (!active) return;
      stopWishes = subscribeWishlist(uid, wishes => { if (active) setState(value => ({ ...value, uid, wishes, wishLoading: false, wishError: '' })); }, cause => {
        if (active) setState(value => ({ ...value, wishes: [], wishLoading: false, wishError: circulationError(cause) }));
      });
      stopNotices = subscribeNotices(uid, notifications => { if (active) setState(value => ({ ...value, uid, notifications, noticeLoading: false })); }, cause => {
        if (active) setState(value => ({ ...value, notifications: [], noticeLoading: false, noticeError: circulationError(cause) }));
      });
    }).catch(cause => { if (active) setState(value => ({ ...value, wishLoading: false, noticeLoading: false, wishError: circulationError(cause), noticeError: circulationError(cause) })); });
    return () => { active = false; stopWishes(); stopNotices(); };
  }, [uid, attempt]);
  const current = state.uid === uid ? state : { ...empty, uid, wishLoading: Boolean(uid), noticeLoading: Boolean(uid) };
  useEffect(() => {
    if (!uid || current.wishLoading || current.wishError) return;
    let active = true, stop = () => {};
    const fail = (cause: unknown) => { if (active) setState(value => value.uid === uid ? { ...value, noticeError: circulationError(cause) } : value); };
    void import('../services/readerExtras').then(({ watchAvailability }) => { if (active) stop = watchAvailability(uid, current.wishes, fail); }).catch(fail);
    return () => { active = false; stop(); };
  }, [uid, current.wishes, current.wishLoading, current.wishError, attempt]);
  return <Context.Provider value={{ ...current, retry: () => setAttempt(value => value + 1) }}>{children}</Context.Provider>;
}
