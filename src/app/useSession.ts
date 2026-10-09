import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { sessionChanged, useAppDispatch } from './store';

export function useSession() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!auth) { dispatch(sessionChanged(null)); return; }
    return onAuthStateChanged(auth, user => dispatch(sessionChanged(user ? {
      uid: user.uid, email: user.email, displayName: user.displayName
    } : null)), () => dispatch(sessionChanged(null)));
  }, [dispatch]);
}
