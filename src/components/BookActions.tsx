import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAppSelector } from '../app/store';
import { useCopy, useReaderLibrary } from '../app/useCirculation';
import { useLibraryAction } from '../app/useLibraryAction';
import { borrowBook, cancelReservation, reserveBook } from '../services/circulation';
import { canBorrow, canReserve } from '../domain/policy';
import type { Book } from '../domain/models';
import { initialDigitalCopy, canReadLoan, hasDigitalEdition } from '../domain/wikisource';
import ReadingControl from './ReadingControl';
import styles from '../styles/Ui.module.css';

export default function BookActions({ book }: { book: Book }) {
  const reader = useAppSelector(state => state.session.reader);
  const ready = useAppSelector(state => state.session.ready);
  const inventory = useCopy(book.id, hasDigitalEdition(book));
  const library = useReaderLibrary();
  const action = useLibraryAction();
  const copy = inventory.copy || initialDigitalCopy(book);
  const { loans, reservations, progress } = library.data;
  const ownLoan = loans.find(loan => loan.workId === book.id && !loan.returnedAt);
  const reservation = reservations.find(row => row.workId === book.id && row.status === 'waiting');
  const loading = !ready || inventory.loading || library.loading;
  const error = inventory.error || library.error;
  const priority = copy?.reservedForUserId;
  const queuePosition = copy?.queue?.indexOf(reader?.uid || '') ?? -1;
  const availability = !hasDigitalEdition(book) ? 'Edição indisponível para novos empréstimos' : !copy ? 'Sem exemplar cadastrado' : ownLoan ? 'Este livro está com você' : copy.activeLoanId ? 'Exemplar emprestado' : priority ? priority === reader?.uid ? 'Seu exemplar está disponível' : 'Aguardando um leitor da fila' : 'Disponível para empréstimo';
  return <section className={styles.circulationPanel} aria-label="Empréstimo e leitura">
    <div className={styles.infoBox}><BookOpen size={22} aria-hidden="true" /><div><strong>{!reader ? 'Disponibilidade para empréstimo' : loading ? 'Consultando disponibilidade…' : error ? 'Consulta indisponível' : availability}</strong>
      <p>{!reader ? 'Entre na sua conta para consultar o acervo e solicitar um empréstimo.' : loading ? 'Aguarde a confirmação da biblioteca.' : error ? error : !copy ? 'Esta obra faz parte do catálogo público, mas ainda não está no acervo da biblioteca.' : ownLoan ? `Devolução até ${new Date(ownLoan.dueAt).toLocaleDateString('pt-BR')}.` : reservation ? priority === reader.uid ? 'Você é o primeiro da fila. Solicite seu empréstimo.' : `Sua posição na fila: ${queuePosition >= 0 ? queuePosition + 1 : 'atualizando…'}.` : 'Empréstimo por 14 dias, com até três livros ativos por conta.'}</p>
    </div></div>
    {!reader ? hasDigitalEdition(book) ? <Link to="/entrar" state={{ from: `/livros/${book.id}` }} className={styles.primary}>Entrar para solicitar</Link> : <Link to="/estante" className={styles.secondary}>Conhecer a estante digital</Link> : loading ? null : error ? <button className={styles.secondary} onClick={() => { inventory.retry(); library.retry(); }}>Tentar novamente</button> : <>
      <div className={styles.actions}>
        {hasDigitalEdition(book) && copy && canBorrow(reader.uid, copy, loans) && <button className={styles.primary} disabled={action.busy} onClick={() => void action.run(() => borrowBook(book.id, book), 'Empréstimo confirmado. Acompanhe o prazo na sua biblioteca.')}>{action.busy ? 'Solicitando…' : 'Solicitar empréstimo'}</button>}
        {hasDigitalEdition(book) && canReadLoan(ownLoan) && <Link className={styles.primary} to={`/ler/${book.id}`}>Ler no LaCervo</Link>}
        {hasDigitalEdition(book) && copy && canReserve(reader.uid, copy, loans, reservations) && <button className={styles.primary} disabled={action.busy} onClick={() => void action.run(() => reserveBook(book.id), 'Reserva confirmada. Você entrou na fila deste livro.')}>{action.busy ? 'Reservando…' : 'Reservar livro'}</button>}
        {reservation && <button className={styles.secondary} disabled={action.busy} onClick={() => void action.run(() => cancelReservation(reservation.id), 'Reserva cancelada.')}>Cancelar reserva</button>}
        <Link to="/minha-biblioteca" className={styles.secondary}>Minha biblioteca</Link>
      </div>
      {copy && !copy.activeLoanId && loans.filter(loan => !loan.returnedAt).length >= 3 && <p className={styles.formNote}>Você atingiu o limite de três empréstimos. Devolva um livro para solicitar outro.</p>}
      <ReadingControl key={`${reader.uid}:${book.id}`} book={book} status={progress.find(row => row.workId === book.id)?.status} />
    </>}
    {action.error && <p className={styles.formError} role="alert">{action.error}</p>}
    <p className={styles.feedback} role="status">{action.message}</p>
  </section>;
}
