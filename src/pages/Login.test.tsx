import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { sessionChanged, store } from '../app/store';
import Login from './Login';

jest.mock('../services/firebase', () => ({ auth: { name: 'test-auth' } }));
jest.mock('firebase/auth', () => ({ signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(), sendPasswordResetEmail: jest.fn() }));
const signIn = jest.mocked(signInWithEmailAndPassword);

function open(from?: string) {
  return render(<Provider store={store}><MemoryRouter initialEntries={[{ pathname: '/entrar', state: { from } }]}><Routes>
    <Route path="/entrar" element={<Login />} /><Route path="/minha-biblioteca" element={<h1>Biblioteca pessoal</h1>} /><Route path="/livros/:id" element={<h1>Detalhes do livro</h1>} />
  </Routes></MemoryRouter></Provider>);
}
async function fillCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), 'reader@example.test');
  await user.type(screen.getByLabelText('Senha'), 'Leitura123!');
  return user;
}
beforeEach(() => { jest.resetAllMocks(); store.dispatch(sessionChanged(null)); });

describe('login form', () => {
  it('shows labeled fields, masks the password and blocks missing credentials', async () => {
    open(); expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar' }));
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByLabelText('E-mail')).toBeInvalid();
  });
  it('disables repeated submissions while authentication is pending and opens the private area', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof signInWithEmailAndPassword>>) => void;
    signIn.mockImplementation(() => new Promise(complete => { resolve = complete; }));
    open(); const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('button', { name: 'Aguarde…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Aguarde…' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({} as Awaited<ReturnType<typeof signInWithEmailAndPassword>>); store.dispatch(sessionChanged({ uid: 'reader', email: 'reader@example.test', displayName: null })); });
    expect(await screen.findByRole('heading', { name: 'Biblioteca pessoal' })).toBeInTheDocument();
  });
  it('shows invalid credentials and allows another attempt', async () => {
    signIn.mockRejectedValue({ code: 'auth/invalid-credential' }); open(); const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira seus dados');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
  it('explains a connection failure without leaving the login page', async () => {
    signIn.mockRejectedValue({ code: 'auth/network-request-failed' }); open(); const user = await fillCredentials();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão');
  });
  it('creates an account and offers password recovery without revealing account existence', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue({} as Awaited<ReturnType<typeof createUserWithEmailAndPassword>>);
    jest.mocked(sendPasswordResetEmail).mockResolvedValue(undefined); open(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Criar uma conta' }));
    await fillCredentials(); await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(createUserWithEmailAndPassword).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Voltar para o login' }));
    await user.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar instruções' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se este e-mail estiver cadastrado');
  });
  it('returns a signed-in reader to a valid book route but rejects an external destination', () => {
    store.dispatch(sessionChanged({ uid: 'reader', email: null, displayName: null }));
    const view = open('/livros/OL1W'); expect(screen.getByRole('heading', { name: 'Detalhes do livro' })).toBeInTheDocument(); view.unmount();
    open('https://example.com'); expect(screen.getByRole('heading', { name: 'Biblioteca pessoal' })).toBeInTheDocument();
  });
});
