import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useSession } from '../app/useSession';
import { sessionChanged, store } from '../app/store';
import Layout from './Layout';

jest.mock('../services/firebase', () => ({ auth: { name: 'test-auth' } }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), signOut: jest.fn() }));
let listener: (user: User | null) => void;
const stop = jest.fn();
function SessionLayout() { useSession(); return <Layout><p>Conteúdo da biblioteca</p></Layout>; }
function open() { return render(<Provider store={store}><MemoryRouter><SessionLayout /></MemoryRouter></Provider>); }
beforeEach(() => {
  jest.resetAllMocks(); store.dispatch(sessionChanged(null));
  jest.mocked(onAuthStateChanged).mockImplementation((_auth, next) => { listener = next as typeof listener; return stop; });
});
describe('session layout', () => {
  it('keeps the author credits collapsed in the footer until About is opened', async () => {
    open();
    expect(screen.getByText('Criado por: Caiã Lucas Leite Oliveira')).not.toBeVisible();
    await userEvent.setup().click(screen.getByText('Sobre'));
    expect(screen.getByText('Criado por: Caiã Lucas Leite Oliveira')).toBeVisible();
    expect(screen.getByText('Projeto da Jala University')).toBeVisible();
  });
  it('updates the header after authentication and clears it on successful logout', async () => {
    jest.mocked(signOut).mockImplementation(async () => { listener(null); });
    const view = open();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    act(() => listener({ uid: 'reader', email: 'reader@example.test', displayName: 'Leitor' } as User));
    expect(screen.getByText('Leitor')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(store.getState().session.reader).toBeNull();
    view.unmount(); expect(stop).toHaveBeenCalledTimes(1);
  });
  it('keeps the account visible and explains a failed logout', async () => {
    jest.mocked(signOut).mockRejectedValue(new Error('offline')); open();
    act(() => listener({ uid: 'reader', email: 'reader@example.test', displayName: 'Leitor' } as User));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair');
    expect(screen.getByText('Leitor')).toBeInTheDocument();
  });
});
