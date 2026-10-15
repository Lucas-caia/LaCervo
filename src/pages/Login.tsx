import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { BookOpen, LockKeyhole } from 'lucide-react';
import { auth } from '../services/firebase';
import { useAppSelector } from '../app/store';
import styles from '../styles/Ui.module.css';

export default function Login() {
  const reader = useAppSelector(state => state.session.reader);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && /^\/(livros|ler)\/(OL\d+W|WS[1-9]\d{0,11})$/.test(from) ? from : '/minha-biblioteca';
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (reader) return <Navigate to={destination} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!auth || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'register') await createUserWithEmailAndPassword(auth, email.trim(), password);
      else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('Se este e-mail estiver cadastrado, você receberá as instruções de recuperação.');
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    }
    catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde um pouco e tente novamente.' : code === 'auth/network-request-failed' ? 'Verifique sua conexão e tente novamente.' : mode === 'register' ? 'Não foi possível criar a conta. Confira o e-mail e use uma senha de pelo menos seis caracteres.' : mode === 'reset' ? 'Não foi possível enviar as instruções. Confira o e-mail e tente novamente.' : 'Não foi possível entrar. Confira seus dados e tente novamente.');
    }
    finally { setBusy(false); }
  }
  return <div className={styles.loginLayout}>
    <div className={styles.loginIntro}><BookOpen size={46} /><p className={styles.eyebrow}>BEM-VINDO AO LACERVO</p><h1>Um lugar para<br/>suas próximas leituras.</h1><p>Consulte seus livros e acompanhe os prazos de devolução.</p></div>
    <div className={styles.loginCard}><LockKeyhole size={25} /><h2>{mode === 'register' ? 'Crie sua conta' : mode === 'reset' ? 'Recupere sua senha' : 'Entre na sua conta'}</h2>
      {!auth ? <><p>O acesso à conta ainda não está disponível. Você pode continuar explorando os livros.</p><Link to="/" className={styles.primary}>Explorar catálogo</Link></> : <form onSubmit={submit}>
        <label>E-mail<input type="email" name="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /></label>
        {mode !== 'reset' && <label>Senha<input type="password" name="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label>}
        {error && <p role="alert" className={styles.formError}>{error}</p>}
        <p role="status" className={styles.feedback}>{message}</p>
        <button className={styles.primary} disabled={busy} type="submit">{busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : mode === 'reset' ? 'Enviar instruções' : 'Entrar'}</button>
        <div className={styles.loginLinks}>{(mode === 'login' ? ['register', 'reset'] : ['login']).map(value => <button key={value} type="button" className={styles.textLink} disabled={busy} onClick={() => { setMode(value as typeof mode); setPassword(''); setError(''); setMessage(''); }}>{value === 'register' ? 'Criar uma conta' : value === 'reset' ? 'Esqueci minha senha' : 'Voltar para o login'}</button>)}</div>
      </form>}
    </div>
  </div>;
}
