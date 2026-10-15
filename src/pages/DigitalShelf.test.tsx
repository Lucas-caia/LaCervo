import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { booksApi } from '../services/books';
import { sessionChanged, store } from '../app/store';
import { digitalBooks } from '../test/fixtures';
import DigitalShelf from './DigitalShelf';

const fetchMock = jest.mocked(fetch);
const book = { ...digitalBooks[0], id: 'WS987', title: 'Um título vindo da API' };
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const page = { books: [book], total: 100, hasNext: true };
function open(path = '/estante') { render(<Provider store={store}><MemoryRouter initialEntries={[path]}><DigitalShelf /></MemoryRouter></Provider>); }
beforeEach(() => { fetchMock.mockReset(); store.dispatch(sessionChanged(null)); });
afterEach(() => { cleanup(); store.dispatch(booksApi.util.resetApiState()); });
describe('dynamic Wikisource shelf', () => {
  it('recovers a bookmarked page beyond the current catalog without losing the search', async () => {
    fetchMock.mockResolvedValueOnce(response({ books: [], total: 1, hasNext: false })).mockResolvedValueOnce(response({ ...page, total: 1, hasNext: false }));
    open('/estante?q=obra&page=999');
    await screen.findByRole('heading', { name: book.title });
    const url = new URL((fetchMock.mock.calls.at(-1)![0] as Request).url);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('q')).toBe('obra');
  });
  it('renders the online response instead of a predefined list of books', async () => {
    fetchMock.mockResolvedValueOnce(response(page)); open();
    expect(screen.getByRole('status', { name: 'Carregando a Wikisource' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: book.title })).toBeInTheDocument();
    expect(screen.getByText('Leitura por empréstimo')).toBeInTheDocument();
    expect((fetchMock.mock.calls[0][0] as Request).url).toContain('/api/catalog');
  });
  it('loads the next API page and replaces the preceding results', async () => {
    fetchMock.mockResolvedValueOnce(response(page)); open(); await screen.findByRole('heading', { name: book.title });
    fetchMock.mockResolvedValueOnce(response({ books: [{ ...book, id: 'WS988', title: 'Outra edição online' }], total: 100, hasNext: false }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByRole('heading', { name: 'Outra edição online' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: book.title })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(new URL((fetchMock.mock.calls.at(-1)![0] as Request).url).searchParams.get('page')).toBe('2');
  });
  it('recovers from a failed upstream request and supports an empty search', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline')); open();
    await screen.findByRole('alert'); fetchMock.mockResolvedValueOnce(response(page));
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('heading', { name: book.title });
    fetchMock.mockResolvedValueOnce(response({ books: [], total: 0, hasNext: false }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar na estante digital' }), 'Nada');
    await user.click(screen.getByRole('button', { name: 'Buscar na Wikisource' }));
    expect(await screen.findByRole('heading', { name: 'Nenhuma edição encontrada' })).toBeInTheDocument();
    expect(new URL((fetchMock.mock.calls.at(-1)![0] as Request).url).searchParams.get('q')).toBe('Nada');
  });
});
