import { useEffect, useState } from 'react';
import { useAppSelector } from './store';
import { subscribeCopy, subscribeReaderLibrary, circulationError, type ReaderLibrary } from '../services/circulation';
import type { LibraryCopy } from '../domain/models';

const empty: ReaderLibrary = { loans: [], reservations: [], progress: [] };
export function useReaderLibrary() {
  const uid = useAppSelector(state => state.session.reader?.uid);
  const [state, setState] = useState({ uid: undefined as string | undefined, data: empty, loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState({ uid, data: empty, loading: Boolean(uid), error: '' });
    if (!uid) return;
    let active = true;
    const stop = subscribeReaderLibrary(uid, data => { if (active) setState({ uid, data, loading: false, error: '' }); }, error => {
      if (active) setState({ uid, data: empty, loading: false, error: circulationError(error) });
    });
    return () => { active = false; stop(); };
  }, [uid, attempt]);
  // Never show the previous reader's data while a session change is being rendered.
  return { ...(state.uid === uid ? state : { uid, data: empty, loading: Boolean(uid), error: '' }), retry: () => setAttempt(value => value + 1) };
}

export function useCopy(workId: string) {
  const uid = useAppSelector(state => state.session.reader?.uid);
  const key = `${uid || ''}:${workId}`;
  const [state, setState] = useState({ key: '', copy: null as LibraryCopy | null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState({ key, copy: null, loading: Boolean(uid), error: '' });
    if (!uid) return;
    let active = true;
    const stop = subscribeCopy(workId, copy => { if (active) setState({ key, copy, loading: false, error: '' }); }, error => {
      if (active) setState({ key, copy: null, loading: false, error: circulationError(error) });
    });
    return () => { active = false; stop(); };
  }, [uid, workId, key, attempt]);
  return { ...(state.key === key ? state : { key, copy: null, loading: Boolean(uid), error: '' }), retry: () => setAttempt(value => value + 1) };
}
