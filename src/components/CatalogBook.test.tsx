import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { sessionChanged, store } from '../app/store';
import type { Book, LibraryCopy } from '../domain/models';
import { digitalBooks } from '../test/fixtures';
import CatalogBook from './CatalogBook';

const mockInventory = { copy: null as LibraryCopy | null, loading: false, error: '' };
jest.mock('../app/useCirculation', () => ({ useCopy: () => mockInventory }));
const unavailable: Book = { id: 'OL999W', title: 'Somente metadados', authors: [], coverId: null, publicationYear: null, subjects: [] };
function open(book = unavailable) { render(<Provider store={store}><MemoryRouter><CatalogBook book={book} /></MemoryRouter></Provider>); }
beforeEach(() => { mockInventory.copy = null; mockInventory.loading = false; mockInventory.error = ''; store.dispatch(sessionChanged({ uid: 'reader', email: null, displayName: null })); });
describe('availability before opening a book', () => {
  it('marks a missing ordinary inventory copy as unavailable', () => {
    open(); expect(screen.getByText('Empréstimo indisponível')).toBeInTheDocument();
    expect(screen.getByText('Leitura indisponível')).toBeInTheDocument();
  });
  it('does not turn a network failure into a confirmed stock status', () => {
    mockInventory.error = 'offline'; open(digitalBooks[0]);
    expect(screen.getByText('Disponibilidade não confirmada')).toBeInTheDocument();
    expect(screen.queryByText('Disponível para empréstimo')).not.toBeInTheDocument();
  });
  it('shows a reserved copy as waiting while its public text remains readable', () => {
    mockInventory.copy = { workId: digitalBooks[0].id, activeLoanId: null, reservedForUserId: 'other', queue: ['other'] }; open(digitalBooks[0]);
    expect(screen.getByText('Reservado · aguarde a fila')).toBeInTheDocument();
    expect(screen.getByText('Leitura por empréstimo')).toBeInTheDocument();
  });
  it('asks guests to sign in rather than inventing inventory availability', () => {
    store.dispatch(sessionChanged(null)); open(digitalBooks[0]);
    expect(screen.getByText('Empréstimos: entre para consultar')).toBeInTheDocument();
    expect(screen.queryByText('Empréstimo indisponível')).not.toBeInTheDocument();
  });
});
