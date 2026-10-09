import { useRef, useState } from 'react';
import { circulationError } from '../services/circulation';

export function useLibraryAction() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run(command: () => Promise<void>, success: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(''); setError('');
    try { await command(); setMessage(success); }
    catch (cause) { setError(circulationError(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  return { busy, message, error, run };
}
