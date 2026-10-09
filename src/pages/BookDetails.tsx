import { useLocation, useParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import BookActions from '../components/BookActions';
import { useAppSelector } from '../app/store';
import { BookCover } from '../components/BookCard';
import { ErrorState, LoadingState } from '../components/States';
import { useBookDetailsQuery } from '../services/books';
import type { Book } from '../domain/models';
import styles from '../styles/Ui.module.css';

export default function BookDetails() {
  const { id = '' } = useParams();
  const readerId = useAppSelector(state => state.session.reader?.uid || 'guest');
  const location = useLocation();
  const preview = (location.state as { book?: Book } | null)?.book;
  const { data, isLoading, isError, refetch } = useBookDetailsQuery(id);
  const book = data ? { ...data, publicationYear: preview?.id === id ? preview.publicationYear : data.publicationYear,
    authors: data.authors.length ? data.authors : preview?.id === id ? preview.authors : [] } : undefined;
  return <><Link to="/" className={styles.back}><ArrowLeft size={17} />Voltar ao catálogo</Link>
    {isLoading ? <LoadingState /> : isError || !book ? <ErrorState retry={refetch} /> : <div className={styles.bookDetail}>
      <BookCover book={book} large />
      <div><p className={styles.eyebrow}>NO CATÁLOGO</p><h1>{book.title}</h1><p className={styles.author}>{book.authors.join(', ') || 'Autor não informado'}</p>
        {book.publicationYear && <p className={styles.bookYear}><CalendarDays size={17} />Primeira publicação: {book.publicationYear}</p>}
        <div className={styles.tags}>{book.subjects.map(subject => <span key={subject}>{subject}</span>)}</div>
        <h2>Sobre o livro</h2><p className={styles.description}>{book.description || 'A Open Library ainda não disponibilizou uma descrição para esta obra.'}</p>
        <BookActions key={`${readerId}:${book.id}`} book={book} />
        <a className={styles.secondary} href={`https://openlibrary.org/works/${book.id}`} target="_blank" rel="noreferrer">Consultar na Open Library</a>
      </div>
    </div>}
  </>;
}
