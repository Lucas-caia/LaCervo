import type { ReactNode } from 'react';
import { BookOpen, Library, LogOut, UserRound, Bookmark } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { lazy, Suspense, useState } from 'react';
import { auth } from '../services/firebase';
import { useAppSelector } from '../app/store';
import styles from '../styles/Layout.module.css';
const NotificationBell = lazy(() => import('./NotificationBell'));

export default function Layout({ children }: { children: ReactNode }) {
  const reader = useAppSelector(state => state.session.reader);
  const [logoutError, setLogoutError] = useState('');
  return <div className={styles.app}>
    <a href="#main-content" className={styles.skip}>Pular para o conteúdo</a>
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="LaCervo, página inicial"><span className={styles.brandIcon}><img src="/favicon.svg" width="40" height="40" alt="" aria-hidden="true" /></span>LaCervo<span className={styles.brandDot}>.</span></Link>
      <span className={styles.institution}>BIBLIOTECA UNIVERSITÁRIA</span>
      <div className={styles.account}>{reader && <Suspense fallback={null}><NotificationBell /></Suspense>}{reader ? <>
        <span className={styles.reader}>{reader.displayName || reader.email?.split('@')[0] || 'Leitor'}</span>
        <button aria-label="Sair da conta" onClick={async () => { try { if (auth) await signOut(auth); } catch { setLogoutError('Não foi possível sair. Tente novamente.'); } }}><LogOut size={18} /></button>
      </> : <Link to="/entrar"><UserRound size={17} />Entrar</Link>}</div>
    </header>
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.navLabel}>SUA BIBLIOTECA</p>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}><Library size={19} />Explorar catálogo</NavLink>
          <NavLink to="/estante" className={({ isActive }) => isActive ? styles.active : ''}><Bookmark size={19} />Estante digital</NavLink>
          <NavLink to="/minha-biblioteca" className={({ isActive }) => isActive ? styles.active : ''}><BookOpen size={19} />Minha biblioteca</NavLink>
        </nav>
        <div className={styles.sidebarNote}><div className={styles.line} /><span>Entre páginas,<br/>sinta-se em casa.</span><p>Um pequeno refúgio para grandes histórias.</p></div>
        <div className={styles.source}>Um livro de cada vez.</div>
      </aside>
      <main id="main-content" tabIndex={-1} className={styles.main}>{logoutError && <p role="alert">{logoutError}</p>}{children}</main>
    </div>
    <footer className={styles.footer}><span>LaCervo · Biblioteca universitária</span><div className={styles.footerLinks}><a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a><a href="https://pt.wikisource.org" target="_blank" rel="noreferrer">Wikisource</a>
      <details className={styles.about}><summary>Sobre</summary><div><strong>LaCervo</strong><p>Criado por: Caiã Lucas Leite Oliveira</p><p>Projeto da Jala University</p></div></details></div></footer>
  </div>;
}
