import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store, sessionChanged } from '../app/store';
import BookActions from './BookActions';
import type { Book, LibraryCopy, Loan } from '../domain/models';
import { digitalBooks } from '../test/fixtures';

const mocks = { borrow: jest.fn<(...args: unknown[]) => Promise<void>>(), reserve: jest.fn<(...args: unknown[]) => Promise<void>>(), cancel: jest.fn<(...args: unknown[]) => Promise<void>>(), progress: jest.fn<(...args: unknown[]) => Promise<void>>(), copy: { workId: 'WS1', activeLoanId: null, reservedForUserId: null, queue: [] } as LibraryCopy | null, loans: [] as Loan[] };
jest.mock('../app/useCirculation', () => ({ useCopy: () => ({ copy: mocks.copy, loading: false, error: '', retry: jest.fn() }), useReaderLibrary: () => ({ data: { loans: mocks.loans, reservations: [], progress: [] }, loading: false, error: '', retry: jest.fn() }) }));
jest.mock('../services/circulation', () => ({ borrowBook: (...args: unknown[]) => mocks.borrow(...args), reserveBook: (...args: unknown[]) => mocks.reserve(...args), cancelReservation: (...args: unknown[]) => mocks.cancel(...args), saveReadingProgress: (...args: unknown[]) => mocks.progress(...args), circulationError: (error: Error) => error.message }));
const book: Book = { ...digitalBooks[0], id: 'WS1', title: 'Livro de teste' };
function open(selectedBook: Book = book) { return render(<Provider store={store}><MemoryRouter><BookActions book={selectedBook} /></MemoryRouter></Provider>); }
beforeEach(() => {
  jest.resetAllMocks(); mocks.copy = { workId: 'WS1', activeLoanId: null, reservedForUserId: null, queue: [] }; mocks.loans = [];
  store.dispatch(sessionChanged({ uid: 'reader', email: 'reader@example.test', displayName: null }));
});
describe('book circulation controls', () => {
  it('offers the first loan of a dynamic Wikisource edition without a manually seeded copy', async () => {
    mocks.copy = null; mocks.borrow.mockResolvedValue(undefined); open(digitalBooks[0]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Solicitar empréstimo' }));
    expect(mocks.borrow).toHaveBeenCalledWith(digitalBooks[0].id, digitalBooks[0]);
    expect(await screen.findByText('Empréstimo confirmado. Acompanhe o prazo na sua biblioteca.')).toBeInTheDocument();
  });
  it('offers guests access to the login instead of private actions', () => {
    store.dispatch(sessionChanged(null)); open();
    expect(screen.getByRole('link', { name: 'Entrar para solicitar' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByRole('button', { name: 'Solicitar empréstimo' })).not.toBeInTheDocument();
  });
  it('confirms a successful loan and displays a rejected operation', async () => {
    mocks.borrow.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('O exemplar já está emprestado.'));
    open(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Solicitar empréstimo' }));
    expect(await screen.findByText('Empréstimo confirmado. Acompanhe o prazo na sua biblioteca.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Solicitar empréstimo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O exemplar já está emprestado.');
  });
  it('offers a reservation for an occupied copy', async () => {
    mocks.copy!.activeLoanId = 'other-loan'; mocks.reserve.mockResolvedValue(undefined); open();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reservar livro' }));
    expect(mocks.reserve).toHaveBeenCalledWith('WS1');
    expect(await screen.findByText('Reserva confirmada. Você entrou na fila deste livro.')).toBeInTheDocument();
  });
  it('prevents a loan request at the limit and saves reading progress independently', async () => {
    mocks.loans = [1, 2, 3].map(id => ({ id: String(id), userId: 'reader', workId: `WS${id}`, borrowedAt: '2026-10-01T00:00:00Z', dueAt: '2026-10-15T00:00:00Z', returnedAt: null }));
    mocks.progress.mockResolvedValue(undefined); open();
    expect(screen.queryByRole('button', { name: 'Solicitar empréstimo' })).not.toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: /Progresso de leitura de/ }), 'reading');
    expect(mocks.progress).toHaveBeenCalledWith(book, 'reading');
    expect(await screen.findByText('Progresso de leitura atualizado.')).toBeInTheDocument();
  });
});
