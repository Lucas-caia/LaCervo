import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { sessionChanged, store } from '../app/store';
import type { Loan, Reservation, ReadingProgress, WishItem, LibraryCopy } from '../domain/models';
import { digitalBooks } from '../test/fixtures';
import MyLibrary from './MyLibrary';

const book = digitalBooks[0];
const mockLibrary = { data: { loans: [] as Loan[], reservations: [] as Reservation[], progress: [] as ReadingProgress[] }, loading: false, error: '', retry: jest.fn() };
const mockExtras = { uid: 'reader', wishes: [] as WishItem[], notifications: [], wishLoading: false, noticeLoading: false, wishError: '', noticeError: '', retry: jest.fn() };
const mockReturn = jest.fn<(...args: unknown[]) => Promise<void>>(), mockBorrow = jest.fn<(...args: unknown[]) => Promise<void>>(), mockCancel = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockInventory = { copy: null as LibraryCopy | null, loading: false, error: '', retry: jest.fn() };
jest.mock('../app/useCirculation', () => ({ useReaderLibrary: () => mockLibrary, useCopy: () => mockInventory }));
jest.mock('../app/ReaderExtras', () => ({ useReaderExtras: () => mockExtras }));
jest.mock('../services/readerExtras', () => ({ addWish: jest.fn(), removeWish: jest.fn() }));
jest.mock('../services/circulation', () => ({ returnLoan: (...args: unknown[]) => mockReturn(...args), borrowBook: (...args: unknown[]) => mockBorrow(...args), cancelReservation: (...args: unknown[]) => mockCancel(...args), circulationError: (error: Error) => error.message }));
const loan = (): Loan => ({ id: 'loan', workId: book.id, userId: 'reader', borrowedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 86400000).toISOString(), returnedAt: null, book });
function open(path = '/minha-biblioteca') { return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><MyLibrary /></MemoryRouter></Provider>); }
beforeEach(() => {
  jest.resetAllMocks(); store.dispatch(sessionChanged({ uid: 'reader', email: null, displayName: null }));
  mockLibrary.data = { loans: [], reservations: [], progress: [] }; mockLibrary.loading = false; mockLibrary.error = '';
  mockExtras.wishes = []; mockExtras.wishLoading = false; mockExtras.wishError = '';
  mockInventory.copy = null; mockInventory.loading = false; mockInventory.error = '';
  mockReturn.mockResolvedValue(undefined); mockBorrow.mockResolvedValue(undefined); mockCancel.mockResolvedValue(undefined);
});
describe('personal library navigation and circulation', () => {
  it('opens a shared wishlist URL, displays saved references and allows returning to loans', async () => {
    mockExtras.wishes = [{ id: 'wish', userId: 'reader', workId: 'OL1W', book: { title: book.title, authors: book.authors, coverId: null }, digital: false, createdAt: new Date().toISOString() }];
    open('/minha-biblioteca?tab=wishlist');
    expect(screen.getByRole('button', { name: 'Lista de desejos 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: book.title })).toBeInTheDocument();
    expect(screen.getByText('Empréstimo indisponível')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Empréstimos 0' }));
    expect(screen.getByRole('heading', { name: 'Nenhum empréstimo ativo' })).toBeInTheDocument();
  });
  it('requires confirmation before return and lets the reader cancel that confirmation', async () => {
    mockLibrary.data.loans = [loan()]; open(); const user = userEvent.setup();
    expect(screen.getByRole('link', { name: 'Ler no LaCervo' })).toHaveAttribute('href', `/ler/${book.id}`);
    await user.click(screen.getByRole('button', { name: 'Devolver livro' })); expect(mockReturn).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Voltar' })); expect(screen.queryByText('Confirmar a devolução?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Devolver livro' })); await user.click(screen.getByRole('button', { name: 'Confirmar devolução' }));
    expect(mockReturn).toHaveBeenCalledWith('loan'); expect(await screen.findByText('Devolução confirmada.')).toBeInTheDocument();
  });
  it('shows a return failure without removing the active loan', async () => {
    mockLibrary.data.loans = [loan()]; mockReturn.mockRejectedValue(new Error('Sem conexão.')); open(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Devolver livro' })); await user.click(screen.getByRole('button', { name: 'Confirmar devolução' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.'); expect(screen.getByRole('link', { name: book.title })).toBeInTheDocument();
  });
  it('keeps returned books in history and removes their reading action', () => {
    mockLibrary.data.loans = [{ ...loan(), returnedAt: new Date().toISOString() }]; open('/minha-biblioteca?tab=history');
    expect(screen.getByText('Devolvido')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Ler no LaCervo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Devolver livro' })).not.toBeInTheDocument();
  });
  it('offers an available reservation only to its priority reader', async () => {
    mockLibrary.data.reservations = [{ id: 'reservation', userId: 'reader', workId: book.id, status: 'waiting', createdAt: new Date().toISOString(), book }];
    mockInventory.copy = { workId: book.id, activeLoanId: null, reservedForUserId: 'other', queue: ['other', 'reader'] };
    const view = open('/minha-biblioteca?tab=reservations'); expect(screen.queryByRole('button', { name: 'Solicitar empréstimo' })).not.toBeInTheDocument();
    mockInventory.copy = { workId: book.id, activeLoanId: null, reservedForUserId: 'reader', queue: ['reader'] };
    view.rerender(<Provider store={store}><MemoryRouter initialEntries={['/minha-biblioteca?tab=reservations']}><MyLibrary /></MemoryRouter></Provider>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Solicitar empréstimo' })); expect(mockBorrow).toHaveBeenCalledWith(book.id);
  });
  it('blocks personal pages for guests and recovers a failed wishlist subscription', async () => {
    store.dispatch(sessionChanged(null)); const view = open(); expect(screen.getByRole('link', { name: 'Entrar na conta' })).toBeInTheDocument(); view.unmount();
    store.dispatch(sessionChanged({ uid: 'reader', email: null, displayName: null })); mockExtras.wishError = 'Não foi possível carregar a lista.';
    open('/minha-biblioteca?tab=wishlist'); expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a lista.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(mockExtras.retry).toHaveBeenCalled();
  });
});
