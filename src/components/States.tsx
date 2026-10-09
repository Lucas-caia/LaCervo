import { BookOpen, RefreshCw } from 'lucide-react';
import styles from '../styles/Ui.module.css';

export function LoadingState() {
  return <div className={styles.loading} role="status"><div className={styles.spinner} />Carregando livros…</div>;
}
export function ErrorState({ retry }: { retry: () => void }) {
  return <div className={styles.empty} role="alert"><BookOpen size={36} /><h2>Não foi possível carregar os livros</h2>
    <p>Verifique sua conexão e tente novamente.</p><button className={styles.primary} onClick={retry}><RefreshCw size={17} />Tentar novamente</button></div>;
}
