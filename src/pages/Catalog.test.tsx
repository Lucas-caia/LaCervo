import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store } from '../app/store';
import { booksApi } from '../services/books';
import Catalog from './Catalog';

const fetchMock = jest.mocked(fetch);
const payload = { numFound: 1, docs: [{ key: '/works/OL1003040W', title: 'Dom Casmurro', author_name: ['Machado de Assis'] }] };
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function open() { return render(<Provider store={store}><MemoryRouter><Catalog /></MemoryRouter></Provider>); }
beforeEach(() => { fetchMock.mockReset(); });
afterEach(() => { cleanup(); store.dispatch(booksApi.util.resetApiState()); });

describe('catalog REST integration', () => {
  it('shows loading and renders the books returned by the REST API', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementation(() => new Promise(complete => { resolve = complete; })); open();
    expect(screen.getByRole('status', { name: 'Carregando livros' })).toBeInTheDocument();
    // Resolve after the request actually reaches the network boundary.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    resolve(response(payload));
    expect(await screen.findByRole('heading', { name: 'Dom Casmurro' })).toBeInTheDocument();
    expect(screen.getByText('Machado de Assis')).toBeInTheDocument();
  });
  it('submits a search and shows an empty result instead of stale books', async () => {
    fetchMock.mockResolvedValueOnce(response(payload)); open();
    await screen.findByRole('heading', { name: 'Dom Casmurro' });
    fetchMock.mockResolvedValueOnce(response({ numFound: 0, docs: [] }));
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
