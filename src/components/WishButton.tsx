import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../domain/models';
import { useReaderExtras } from '../app/ReaderExtras';
import { useLibraryAction } from '../app/useLibraryAction';
import { addWish, removeWish } from '../services/readerExtras';
import styles from '../styles/ReaderExtras.module.css';

export default function WishButton({ book, compact = false }: { book: Book; compact?: boolean }) {
  const extras = useReaderExtras(), action = useLibraryAction();
  if (!extras) return null;
  const saved = extras.wishes.some(item => item.workId === book.id);
  const text = saved ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos';
  return <div className={`${styles.wishControl} ${compact ? styles.compact : ''}`}>
    {!extras.uid ? <Link className={styles.wishButton} to="/entrar" state={{ from: `/livros/${book.id}` }} aria-label={`Entre para salvar ${book.title} na lista de desejos`}><Heart size={17} /><span>Salvar para depois</span></Link>
      : <button className={`${styles.wishButton} ${saved ? styles.saved : ''}`} aria-pressed={saved} aria-label={`${text}: ${book.title}`} disabled={action.busy || extras.wishLoading || Boolean(extras.wishError)}
        onClick={() => void action.run(() => saved ? removeWish(book.id) : addWish(book), saved ? 'Livro removido da lista de desejos.' : 'Livro salvo na lista de desejos.')}>
        <Heart size={17} fill={saved ? 'currentColor' : 'none'} /><span>{action.busy ? 'Salvando…' : saved ? 'Salvo na sua lista' : 'Salvar para depois'}</span></button>}
    {extras.wishError && <button className={styles.retry} onClick={extras.retry}>Recarregar lista</button>}
    {action.error && <p className={styles.error} role="alert">{action.error}</p>}
    <span className={styles.srOnly} role="status">{action.message}</span>
  </div>;
}
