import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store } from '../app/store';
import { booksApi } from '../services/books';
import Catalog from './Catalog';

const fetchMock = jest.mocked(fetch);
const payload = { total: 1, books: [{ id: 'OL1003040W', title: 'Dom Casmurro', authors: ['Machado de Assis'], subjects: [], coverId: null, publicationYear: null }] };
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function open(path = '/') { return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Catalog /></MemoryRouter></Provider>); }
beforeEach(() => { fetchMock.mockReset(); });
afterEach(() => { cleanup(); store.dispatch(booksApi.util.resetApiState()); });

describe('catalog REST integration', () => {
  it('recovers an out-of-range bookmarked page and preserves the search filters', async () => {
    fetchMock.mockResolvedValueOnce(response({ total: 1, books: [] })).mockResolvedValueOnce(response(payload));
    open('/?q=Dom&field=title&sort=author&page=999');
    expect(await screen.findByRole('heading', { name: 'Dom Casmurro' })).toBeInTheDocument();
    const url = new URL((fetchMock.mock.calls.at(-1)![0] as Request).url);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('q')).toBe('Dom');
    expect(url.searchParams.get('sort')).toBe('author');
    expect(screen.getByRole('heading', { name: 'Resultados da busca' })).toHaveFocus();
  });
  it('returns keyboard focus to the new results after pagination', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...payload, total: 13 })).mockResolvedValueOnce(response({ total: 13, books: [{ ...payload.books[0], id: 'OL2W', title: 'Nova página' }] }));
    open(); await screen.findByRole('heading', { name: 'Dom Casmurro' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByRole('heading', { name: 'Nova página' });
    expect(screen.getByRole('heading', { name: 'Explore novas leituras' })).toHaveFocus();
  });
  it('shows loading and renders the books returned by the REST API', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise(complete => { resolve = complete; })); open();
    expect(screen.getByRole('status', { name: 'Carregando livros' })).toBeInTheDocument();
    // Resolve after the request actually reaches the network boundary.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    resolve(response(payload));
    expect(await screen.findByRole('heading', { name: 'Dom Casmurro' })).toBeInTheDocument();
    expect(screen.getAllByText('Machado de Assis').length).toBeGreaterThan(0);
  });
  it('submits a search and shows an empty result instead of stale books', async () => {
    fetchMock.mockResolvedValueOnce(response(payload)); open();
    await screen.findByRole('heading', { name: 'Dom Casmurro' });
    fetchMock.mockResolvedValueOnce(response({ total: 0, books: [] }));
    const user = userEvent.setup(); await user.type(screen.getByRole('textbox', { name: 'Buscar livros' }), 'Livro inexistente');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('heading', { name: 'Nenhum livro encontrado' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dom Casmurro' })).not.toBeInTheDocument();
    expect(new URL((fetchMock.mock.calls.at(-1)![0] as Request).url).searchParams.get('q')).toBe('Livro inexistente');
  });
  it('explains a failed request and recovers when the reader retries', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline')); open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    fetchMock.mockResolvedValueOnce(response(payload));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Dom Casmurro' })).toBeInTheDocument();
  });
});
