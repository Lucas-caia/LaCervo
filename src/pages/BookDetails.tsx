import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import BookActions from '../components/BookActions';
import WishButton from '../components/WishButton';
import { useAppSelector } from '../app/store';
import { BookCover } from '../components/BookCard';
import { ErrorState, LoadingState } from '../components/States';
import { useBookDetailsQuery } from '../services/books';
import { useWikiBookQuery } from '../services/wikisource';
import { isWikiBook, hasDigitalEdition } from '../domain/wikisource';
import styles from '../styles/Ui.module.css';

export default function BookDetails() {
  const { id = '' } = useParams();
  const readerId = useAppSelector(state => state.session.reader?.uid || 'guest');
  const wiki = isWikiBook(id);
  const external = useBookDetailsQuery(id, { skip: wiki });
  const digital = useWikiBookQuery(id, { skip: !wiki });
  const result = wiki ? digital : external;
  const book = result.currentData;
  return <><Link to={wiki ? '/estante' : '/'} className={styles.back}><ArrowLeft size={17} />Voltar ao catálogo</Link>
    {result.isFetching && !book ? <LoadingState /> : result.isError || !book ? <ErrorState retry={result.refetch} /> : <div className={styles.bookDetail}>
      <BookCover book={book} large />
      <div><p className={styles.eyebrow}>{wiki ? 'NA ESTANTE DIGITAL' : 'NO CATÁLOGO'}</p><h1>{book.title}</h1><p className={styles.author}>{book.authors.join(', ') || 'Autor não informado'}</p>
        {book.publicationYear && <p className={styles.bookYear}><CalendarDays size={17} />Publicação: {book.publicationYear}</p>}
        <div className={styles.tags}>{book.subjects.map(subject => <span key={subject}>{subject}</span>)}</div>
        <h2>Sobre o livro</h2><p className={styles.description}>{book.description || 'A fonte ainda não disponibilizou uma descrição para esta obra.'}</p>
        {hasDigitalEdition(book) ? <div className={styles.digitalPanel}><span className={styles.badge}>Edição online · Wikisource</span><h2>Um livro aberto, no seu tempo.</h2><p>Faça um empréstimo para ler dentro do LaCervo. Você pode manter até três empréstimos ativos; devolver um livro libera uma vaga. A leitura fica disponível durante o prazo de 14 dias.</p></div>
          : <div className={styles.unavailablePanel}><strong>Leitura digital indisponível</strong><p>Esta obra não possui uma edição disponível para leitura no LaCervo.</p><Link className={styles.textLink} to="/estante">Encontrar uma edição na Wikisource</Link></div>}
        <WishButton book={book} />
        <BookActions key={`${readerId}:${book.id}`} book={book} />
        <a className={styles.secondary} href={wiki ? book.sourceUrl : `https://openlibrary.org/works/${book.id}`} target="_blank" rel="noreferrer">{wiki ? 'Fonte e créditos na Wikisource' : 'Consultar na Open Library'}</a>
      </div>
    </div>}
  </>;
}
