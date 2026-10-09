import type { ReactNode } from 'react';
import { BookOpen, Library, LogOut, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { auth } from '../services/firebase';
import { useAppSelector } from '../app/store';
import styles from '../styles/Layout.module.css';

export default function Layout({ children }: { children: ReactNode }) {
  const reader = useAppSelector(state => state.session.reader);
  const [logoutError, setLogoutError] = useState('');
  return <div className={styles.app}>
    <a href="#main-content" className={styles.skip}>Pular para o conteúdo</a>
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="LaCervo, página inicial"><span className={styles.brandIcon}><BookOpen size={24} /></span>LaCervo<span className={styles.brandDot}>.</span></Link>
      <span className={styles.institution}>BIBLIOTECA UNIVERSITÁRIA</span>
      <div className={styles.account}>{reader ? <>
        <span className={styles.reader}>{reader.displayName || reader.email?.split('@')[0] || 'Leitor'}</span>
        <button aria-label="Sair da conta" onClick={async () => { try { if (auth) await signOut(auth); } catch { setLogoutError('Não foi possível sair. Tente novamente.'); } }}><LogOut size={18} /></button>
      </> : <Link to="/entrar"><UserRound size={17} />Entrar</Link>}</div>
    </header>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.navLabel}>SUA BIBLIOTECA</p>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}><Library size={19} />Explorar catálogo</NavLink>
          <NavLink to="/minha-biblioteca" className={({ isActive }) => isActive ? styles.active : ''}><BookOpen size={19} />Minha biblioteca</NavLink>
        </nav>
        <div className={styles.sidebarNote}><div className={styles.line} /><span>Uma nova leitura<br/>começa por aqui.</span><p>Encontre seu próximo livro.</p></div>
        <div className={styles.source}>Catálogo Open Library</div>
      </aside>
      <main id="main-content" tabIndex={-1} className={styles.main}>{logoutError && <p role="alert">{logoutError}</p>}{children}</main>
    </div>
    <footer className={styles.footer}><span>LaCervo · Biblioteca universitária</span><a href="https://openlibrary.org" target="_blank" rel="noreferrer">Dados da Open Library</a></footer>
  </div>;
}
