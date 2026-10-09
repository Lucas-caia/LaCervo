import type { Book, ReadingStatus } from '../domain/models';
import { saveReadingProgress } from '../services/circulation';
import { useLibraryAction } from '../app/useLibraryAction';
import styles from '../styles/Ui.module.css';

export default function ReadingControl({ book, status = 'not-started', disabled = false }: { book: Book; status?: ReadingStatus; disabled?: boolean }) {
  const action = useLibraryAction();
  return <div className={styles.readingControl}>
    <label>Seu progresso de leitura<select aria-label={`Progresso de leitura de ${book.title}`} value={status} disabled={disabled || action.busy}
      onChange={event => void action.run(() => saveReadingProgress(book, event.target.value as ReadingStatus), 'Progresso de leitura atualizado.')}>
      <option value="not-started">Não iniciado</option><option value="reading">Lendo</option><option value="completed">Concluído</option>
    </select></label>
    {action.error && <p className={styles.formError} role="alert">{action.error}</p>}
    <p className={styles.feedback} role="status">{action.busy ? 'Salvando…' : action.message}</p>
  </div>;
}
