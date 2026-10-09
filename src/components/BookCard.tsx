import { memo, useState } from 'react';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../domain/models';
import styles from '../styles/Catalog.module.css';

export function BookCover({ book, large = false }: { book: Book; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`${styles.cover} ${large ? styles.largeCover : ''}`}>
    {book.coverId && !failed ? <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-${large ? 'L' : 'M'}.jpg?default=false`}
      alt={`Capa de ${book.title}`} width={large ? 300 : 150} height={large ? 420 : 210}
      loading="lazy" onError={() => setFailed(true)} /> : <div className={styles.coverFallback}><BookOpen size={34} /><span>{book.title}</span></div>}
  </div>;
}

function BookCard({ book }: { book: Book }) {
  return <article className={styles.card}>
    <Link to={`/livros/${book.id}`} state={{ book }} className={styles.cardLink}>
      <BookCover book={book} />
      <div className={styles.cardBody}><span className={styles.year}>{book.publicationYear || 'Ano não informado'}</span>
        <h2>{book.title}</h2><p>{book.authors.join(', ') || 'Autor não informado'}</p>
        <span className={styles.detailLink}>Ver detalhes<ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  </article>;
}
export default memo(BookCard);
