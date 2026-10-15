import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WishButton from './WishButton';
import NotificationBell from './NotificationBell';
import WishlistPanel from './WishlistPanel';
import { digitalBooks } from '../test/fixtures';
import type { AvailabilityNotice, WishItem } from '../domain/models';

const mockExtras = { uid: 'reader' as string | undefined, wishes: [] as WishItem[], notifications: [] as AvailabilityNotice[], wishLoading: false, noticeLoading: false, wishError: '', noticeError: '', retry: jest.fn() };
const mockAdd = jest.fn<(...args: unknown[]) => Promise<void>>(), mockRemove = jest.fn<(...args: unknown[]) => Promise<void>>(), mockRead = jest.fn<(...args: unknown[]) => Promise<void>>();
jest.mock('../app/ReaderExtras', () => ({ useReaderExtras: () => mockExtras }));
jest.mock('../services/readerExtras', () => ({ addWish: (...args: unknown[]) => mockAdd(...args), removeWish: (...args: unknown[]) => mockRemove(...args), markNoticeRead: (...args: unknown[]) => mockRead(...args) }));
jest.mock('../app/useCirculation', () => ({ useCopy: () => ({ copy: null, loading: false, error: '' }) }));
jest.mock('../services/circulation', () => ({ circulationError: (error: Error) => error.message }));
const book = digitalBooks[0];
beforeEach(() => {
  jest.resetAllMocks(); mockExtras.uid = 'reader'; mockExtras.wishes = []; mockExtras.notifications = []; mockExtras.wishLoading = false; mockExtras.noticeLoading = false; mockExtras.wishError = ''; mockExtras.noticeError = '';
  mockAdd.mockResolvedValue(undefined); mockRemove.mockResolvedValue(undefined); mockRead.mockResolvedValue(undefined);
});
const open = (element: React.ReactNode) => render(<MemoryRouter>{element}</MemoryRouter>);
describe('wishlist controls and availability notices', () => {
  it('saves a book, exposes success and removes an existing wish', async () => {
    const view = open(<WishButton book={book} />), user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Adicionar à lista/ }));
    expect(mockAdd).toHaveBeenCalledWith(book);
    expect(await screen.findByRole('status')).toHaveTextContent('Livro salvo');
    mockExtras.wishes = [{ id: 'wish', userId: 'reader', workId: book.id, book, digital: true, createdAt: new Date().toISOString() }];
    view.rerender(<MemoryRouter><WishButton book={book} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /Remover da lista/ }); expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button); expect(mockRemove).toHaveBeenCalledWith(book.id);
  });
  it('directs guests to login and keeps private actions unavailable', () => {
    mockExtras.uid = undefined; open(<><WishButton book={book} /><NotificationBell /></>);
    expect(screen.getByRole('link', { name: /Entre para salvar/ })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByText('Seu próximo capítulo')).not.toBeInTheDocument();
  });
  it('explains rejected wishlist changes and allows retrying a failed subscription', async () => {
    mockAdd.mockRejectedValue(new Error('Sem conexão.')); open(<WishButton book={book} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Adicionar à lista/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
  });
  it('shows unread count, links to availability and marks a notification as read', async () => {
    mockExtras.notifications = [{ id: 'notice', userId: 'reader', workId: book.id, eventId: 'event', book, occurredAt: '2026-10-01T10:00:00Z', readAt: null }];
    open(<NotificationBell />); const user = userEvent.setup();
    await user.click(screen.getByLabelText('Notificações, 1 não lidas'));
    expect(screen.getByText(book.title)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver disponibilidade' })).toHaveAttribute('href', `/livros/${book.id}`);
    await user.click(screen.getByRole('button', { name: /Marcar aviso/ })); expect(mockRead).toHaveBeenCalledWith('notice');
  });
  it('does not count read notices and provides recovery from notification errors', async () => {
    mockExtras.noticeError = 'Biblioteca indisponível.'; open(<NotificationBell />);
    await userEvent.setup().click(screen.getByLabelText('Notificações, 0 não lidas'));
    expect(screen.getByRole('alert')).toHaveTextContent('Biblioteca indisponível.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(mockExtras.retry).toHaveBeenCalled();
  });
  it('shows an empty wishlist and a path to discover books', () => {
    open(<WishlistPanel />); expect(screen.getByRole('heading', { name: /Sua lista de desejos/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Encontrar uma leitura' })).toHaveAttribute('href', '/estante');
  });
});

it('marks only unread notices, including notices outside the visible first page', async () => {
  mockExtras.notifications = Array.from({ length: 32 }, (_, index) => ({ id: `notice-${index}`, userId: 'reader', workId: book.id, eventId: `event-${index}`, book,
    occurredAt: '2026-10-01T10:00:00Z', readAt: index === 0 ? '2026-10-02T10:00:00Z' : null }));
  open(<NotificationBell />); const user = userEvent.setup();
  await user.click(screen.getByLabelText('Notificações, 31 não lidas'));
  await user.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(31));
  expect(mockRead).not.toHaveBeenCalledWith('notice-0');
  expect(mockRead).toHaveBeenCalledWith('notice-31');
});

it('keeps a failed mark-read operation visible and permits a second attempt', async () => {
  mockExtras.notifications = [{ id: 'notice', userId: 'reader', workId: book.id, eventId: 'event', book, occurredAt: '2026-10-01T10:00:00Z', readAt: null }];
  mockRead.mockRejectedValueOnce(new Error('Sem conexão.')).mockResolvedValue(undefined);
  open(<NotificationBell />); const user = userEvent.setup();
  await user.click(screen.getByLabelText('Notificações, 1 não lidas'));
  await user.click(screen.getByRole('button', { name: /Marcar aviso/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
  await user.click(screen.getByRole('button', { name: /Marcar aviso/ }));
  expect(mockRead).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('closes the notification panel with Escape and returns keyboard focus to the bell', async () => {
  open(<NotificationBell />); const user = userEvent.setup();
  const summary = screen.getByLabelText('Notificações, 0 não lidas');
  await user.click(summary); expect(summary.closest('details')).toHaveAttribute('open');
  await user.keyboard('{Escape}');
  expect(summary.closest('details')).not.toHaveAttribute('open');
  expect(summary).toHaveFocus();
});

it('recovers a failed wishlist subscription without issuing an add request', async () => {
  mockExtras.wishError = 'Sem conexão.'; open(<WishButton book={book} />);
  expect(screen.getByRole('button', { name: /Adicionar à lista/ })).toBeDisabled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Recarregar lista' }));
  expect(mockExtras.retry).toHaveBeenCalledTimes(1); expect(mockAdd).not.toHaveBeenCalled();
});

it('closes notifications with the visible close control or an outside click', async () => {
  open(<><NotificationBell /><button>Conteúdo da página</button></>);
  const user = userEvent.setup(), summary = screen.getByLabelText('Notificações, 0 não lidas');
  await user.click(summary);
  await user.click(screen.getByRole('button', { name: 'Fechar notificações' }));
  expect(summary.closest('details')).not.toHaveAttribute('open');
  expect(summary).toHaveFocus();
  await user.click(summary);
  await user.click(screen.getByRole('button', { name: 'Conteúdo da página' }));
  expect(summary.closest('details')).not.toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Conteúdo da página' })).toHaveFocus();
});
