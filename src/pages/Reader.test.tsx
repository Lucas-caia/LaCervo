import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { auth } from '../services/firebase';
import { sessionChanged, store } from '../app/store';
import type { Loan } from '../domain/models';
import { digitalBooks } from '../test/fixtures';
import Reader from './Reader';

jest.mock('../services/firebase', () => ({ auth: { currentUser: { getIdToken: jest.fn() } } }));
const mockLibrary = { data: { loans: [] as Loan[], reservations: [], progress: [] }, loading: false, error: '', retry: jest.fn() };
jest.mock('../app/useCirculation', () => ({ useReaderLibrary: () => mockLibrary }));
const fetchMock = jest.mocked(fetch);
const payload = { book: digitalBooks[0], chapter: 0, chapterLabel: 'Início', chapters: [{ index: 0, label: 'Início' }, { index: 1, label: 'Capítulo I' }],
  paragraphs: [`Primeira página. ${'Uma história tranquila. '.repeat(130)}`, `Segunda página. ${'Mais um capítulo. '.repeat(130)}`], revision: 123, sourceUrl: digitalBooks[0].sourceUrl };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function Location() { return <output aria-label="Endereço da leitura">{useLocation().search}</output>; }
function View({ path = '/ler/WS42' }: { path?: string }) { return <Provider store={store}><MemoryRouter initialEntries={[path]}><Routes><Route path="/ler/:id" element={<><Reader /><Location /></>} /></Routes></MemoryRouter></Provider>; }
beforeEach(() => {
  fetchMock.mockReset(); Element.prototype.scrollIntoView = jest.fn();
  store.dispatch(sessionChanged({ uid: 'reader', email: null, displayName: null }));
  mockLibrary.error = ''; mockLibrary.loading = false;
  mockLibrary.data.loans = [{ id: 'active-loan', workId: 'WS42', userId: 'reader', borrowedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 86400000).toISOString(), returnedAt: null, book: digitalBooks[0] }];
  jest.mocked(auth!.currentUser!.getIdToken).mockResolvedValue('verified-test-token');
});

describe('loan-gated in-app reader', () => {
  it('loads authorized text, navigates pages and chapters, and keeps reading preferences', async () => {
    fetchMock.mockResolvedValueOnce(response(payload)); render(<View />);
    expect(await screen.findByRole('article', { name: 'Página 1 de 2' })).toHaveTextContent('Primeira página.');
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Aumentar tamanho do texto' }));
    expect(screen.getByRole('article')).toHaveStyle({ fontSize: '22px' });
    await user.click(screen.getByRole('button', { name: 'Ativar tema noturno' }));
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByRole('article', { name: 'Página 2 de 2' })).toHaveTextContent('Segunda página.');
    expect(screen.getByLabelText('Endereço da leitura')).toHaveTextContent('p=2');
    expect(fetchMock.mock.calls[0][0]).toContain('loan=active-loan');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer verified-test-token' }, cache: 'no-store' });
    fetchMock.mockResolvedValueOnce(response({ ...payload, chapter: 1, chapterLabel: 'Capítulo I', paragraphs: ['O próximo capítulo.'] }));
    await user.click(screen.getByRole('button', { name: 'Próxima parte' }));
    expect(await screen.findByRole('article')).toHaveTextContent('O próximo capítulo.');
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });
  it('blocks a direct reader URL for guests without requesting text', () => {
    store.dispatch(sessionChanged(null)); render(<View />);
    expect(screen.getByRole('heading', { name: 'Entre para continuar a leitura' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('blocks readers without an active loan and readers with an expired loan', () => {
    mockLibrary.data.loans = []; const view = render(<View />);
    expect(screen.getByRole('heading', { name: 'Faça um empréstimo para ler' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled(); view.unmount();
    mockLibrary.data.loans = [{ id: 'old', workId: 'WS42', userId: 'reader', borrowedAt: '2020-01-01T00:00:00Z', dueAt: '2020-01-15T00:00:00Z', returnedAt: null }];
    render(<View />); expect(screen.getByText(/O prazo deste empréstimo terminou/)).toBeInTheDocument(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('removes displayed text immediately when the loan is returned', async () => {
    fetchMock.mockResolvedValueOnce(response(payload)); const view = render(<View />);
    await screen.findByRole('article');
    mockLibrary.data.loans = []; view.rerender(<View />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Faça um empréstimo para ler' })).toBeInTheDocument();
  });
  it('shows a backend denial without displaying the text', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: 'O empréstimo não está mais ativo.' }, 403)); render(<View />);
    expect(await screen.findByRole('alert')).toHaveTextContent('O empréstimo não está mais ativo.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
