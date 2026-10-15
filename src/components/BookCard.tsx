import { memo, useState } from 'react';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../domain/models';
import { hasDigitalEdition } from '../domain/wikisource';
import styles from '../styles/Catalog.module.css';
import WishButton from './WishButton';

export function BookCover({ book, large = false, loanStatus }: { book: Book; large?: boolean; loanStatus?: string }) {
  const [failed, setFailed] = useState(false);
  const readable = hasDigitalEdition(book);
  const image = book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-${large ? 'L' : 'M'}.jpg?default=false` : null;
  return <div className={`${styles.cover} ${large ? styles.largeCover : ''}`}>
    {image && !failed ? <img src={image}
      alt={`Capa de ${book.title}`} width={large ? 300 : 150} height={large ? 420 : 210}
      loading="lazy" onError={() => setFailed(true)} /> : <div className={styles.coverFallback}><small>{book.authors[0] || 'Autor não informado'}</small><BookOpen size={28} /><span>{book.title}</span><small>LACERVO</small></div>}
    {!large && <div className={styles.coverFlags}><span className={readable ? styles.readableFlag : styles.unavailableFlag}>{readable ? 'Leitura por empréstimo' : 'Leitura indisponível'}</span>
      {loanStatus && <span className={styles.loanFlag}>{loanStatus}</span>}</div>}
  </div>;
}

function BookCard({ book, loanStatus }: { book: Book; loanStatus?: string }) {
  return <article className={styles.card}>
    <Link to={`/livros/${book.id}`} state={{ book }} className={styles.cardLink}>
      <BookCover book={book} loanStatus={loanStatus} />
      <div className={styles.cardBody}><span className={styles.year}>{book.publicationYear || 'Ano não informado'}</span>
        <h2>{book.title}</h2><p>{book.authors.join(', ') || 'Autor não informado'}</p>
        <span className={styles.detailLink}>Ver detalhes<ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
    <WishButton book={book} compact />
  </article>;
}
export default memo(BookCard);
