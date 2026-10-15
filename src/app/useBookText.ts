import { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { paginateParagraphs, type ReadingPage } from '../domain/reader';
import type { WikiReading } from '../domain/wikisource';

export function useBookText(workId: string, loanId: string | undefined, enabled: boolean, chapter = 0) {
  const key = `${workId}:${loanId || ''}:${chapter}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: '', pages: [] as ReadingPage[], payload: null as WikiReading | null, loading: false, error: '' });
  useEffect(() => {
    if (!enabled || !loanId) { setState({ key, pages: [], payload: null, loading: false, error: '' }); return; }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    setState({ key, pages: [], payload: null, loading: true, error: '' });
    void (async () => {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error('Entre novamente na sua conta para ler.');
      if (!active) return;
      const params = new URLSearchParams({ id: workId, loan: loanId, chapter: String(chapter) });
      const response = await fetch(`/api/read?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Não foi possível abrir esta parte do livro.');
      if (!Array.isArray(payload.paragraphs) || !payload.paragraphs.every((value: unknown) => typeof value === 'string')) throw new Error('A edição retornou um texto inválido.');
      const pages = paginateParagraphs(payload.paragraphs);
      if (active) setState({ key, pages, payload, loading: false, error: '' });
    })().catch(error => {
      if (active) setState({ key, pages: [], payload: null, loading: false, error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'Não foi possível carregar a leitura. Tente novamente.' });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [key, workId, loanId, chapter, enabled, attempt]);
  // Clear readable content synchronously when the session or active loan changes.
  return { ...(enabled && state.key === key ? state : { key, pages: [], payload: null, loading: enabled, error: '' }), retry: () => setAttempt(value => value + 1) };
}
