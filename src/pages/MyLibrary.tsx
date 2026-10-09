import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, LockKeyhole } from 'lucide-react';
import { useAppSelector } from '../app/store';
import { useCopy, useReaderLibrary } from '../app/useCirculation';
import { useLibraryAction } from '../app/useLibraryAction';
import { borrowBook, cancelReservation, returnLoan } from '../services/circulation';
import type { Book, BookSummary, Loan, Reservation } from '../domain/models';
import { isOverdue } from '../domain/policy';
import { LoadingState } from '../components/States';
import ReadingControl from '../components/ReadingControl';
import styles from '../styles/Ui.module.css';

type Tab = 'active' | 'reservations' | 'history' | 'reading';
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const asBook = (workId: string, book?: BookSummary): Book => ({ id: workId, title: book?.title || 'Livro do acervo', authors: book?.authors || [], coverId: book?.coverId || null, publicationYear: null, subjects: [] });

function LibraryBook({ workId, book }: { workId: string; book?: BookSummary }) {
  return <div className={styles.libraryBook}>
    <Link to={`/livros/${workId}`} tabIndex={-1} aria-hidden="true" className={styles.miniCover}>{book?.coverId ? <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg?default=false`} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <BookOpen size={26} />}</Link>
    <div><Link to={`/livros/${workId}`} className={styles.libraryTitle}>{book?.title || 'Ver livro do acervo'}</Link><p>{book?.authors.join(', ') || 'Autor não informado'}</p></div>
  </div>;
}
function LoanRow({ loan }: { loan: Loan }) {
  const [confirm, setConfirm] = useState(false);
  const action = useLibraryAction();
  const overdue = isOverdue(loan);
  return <article className={styles.libraryRow}><LibraryBook workId={loan.workId} book={loan.book} />
    <div className={styles.loanMeta}><span className={`${styles.badge} ${overdue ? styles.overdue : ''}`}>{loan.returnedAt ? 'Devolvido' : overdue ? 'Em atraso' : 'Emprestado'}</span>
      <p><CalendarDays size={15} />{loan.returnedAt ? `Devolvido em ${date(loan.returnedAt)}` : `Devolução até ${date(loan.dueAt)}`}</p><small>Emprestado em {date(loan.borrowedAt)}</small>
    </div>
    {!loan.returnedAt && <div className={styles.actions}>{confirm ? <><span>Confirmar a devolução?</span><button className={styles.primary} disabled={action.busy} onClick={() => void action.run(() => returnLoan(loan.id), 'Devolução confirmada.')}>{action.busy ? 'Devolvendo…' : 'Confirmar devolução'}</button><button className={styles.secondary} disabled={action.busy} onClick={() => setConfirm(false)}>Voltar</button></> : <button className={styles.secondary} onClick={() => setConfirm(true)}>Devolver livro</button>}</div>}
    {action.error && <p role="alert" className={styles.formError}>{action.error}</p>}<p role="status" className={styles.feedback}>{action.message}</p>
  </article>;
}
function ReservationRow({ reservation }: { reservation: Reservation }) {
  const reader = useAppSelector(state => state.session.reader);
  const { copy, loading, error, retry } = useCopy(reservation.workId);
  const action = useLibraryAction();
  const ready = !copy?.activeLoanId && copy?.reservedForUserId === reader?.uid;
  const position = copy?.queue?.indexOf(reader?.uid || '') ?? -1;
  return <article className={styles.libraryRow}><LibraryBook workId={reservation.workId} book={reservation.book} />
    <div className={styles.loanMeta}><span className={styles.badge}>{loading ? 'Consultando…' : ready ? 'Disponível para você' : 'Na fila de espera'}</span><p>{error ? 'Não foi possível consultar a fila.' : ready ? 'Seu exemplar está pronto para empréstimo.' : position >= 0 ? `Posição ${position + 1} na fila` : 'Atualizando a reserva…'}</p></div>
    <div className={styles.actions}>{ready && !error && <button className={styles.primary} disabled={action.busy} onClick={() => void action.run(() => borrowBook(reservation.workId), 'Empréstimo confirmado.')}>Solicitar empréstimo</button>}
      <button className={styles.secondary} disabled={action.busy || loading || Boolean(error)} onClick={() => void action.run(() => cancelReservation(reservation.id), 'Reserva cancelada.')}>Cancelar reserva</button>{error && <button className={styles.secondary} onClick={retry}>Tentar novamente</button>}</div>
    {action.error && <p role="alert" className={styles.formError}>{action.error}</p>}<p role="status" className={styles.feedback}>{action.message}</p>
  </article>;
}

export default function MyLibrary() {
  const reader = useAppSelector(state => state.session.reader);
  const ready = useAppSelector(state => state.session.ready);
  const library = useReaderLibrary();
  const [tab, setTab] = useState<Tab>('active');
  const { loans, reservations, progress } = library.data;
  const active = loans.filter(loan => !loan.returnedAt);
  const history = loans.filter(loan => loan.returnedAt);
  const waiting = reservations.filter(row => row.status === 'waiting');
  const tabs: { id: Tab; title: string; count: number }[] = [{ id: 'active', title: 'Empréstimos', count: active.length }, { id: 'reservations', title: 'Reservas', count: waiting.length }, { id: 'history', title: 'Histórico', count: history.length }, { id: 'reading', title: 'Minhas leituras', count: progress.length }];
  const count = tabs.find(item => item.id === tab)!.count;
  return <><p className={styles.eyebrow}>SUAS LEITURAS, EM UM SÓ LUGAR</p><h1>Minha biblioteca</h1><p className={styles.subtitle}>Acompanhe seus livros, reservas e próximas devoluções.</p>
    {!ready || library.loading ? <LoadingState /> : !reader ? <div className={styles.empty}><LockKeyhole size={38} /><h2>Seu espaço de leitura</h2><p>Entre na sua conta para acompanhar seus empréstimos e leituras.</p><Link className={styles.primary} to="/entrar">Entrar na conta</Link><Link className={styles.textLink} to="/">Continuar explorando</Link></div>
      : library.error ? <div className={styles.empty} role="alert"><BookOpen size={38} /><h2>Não foi possível abrir sua biblioteca</h2><p>{library.error}</p><button className={styles.secondary} onClick={library.retry}>Tentar novamente</button></div> : <>
        <div className={styles.libraryStats}><div><strong>{active.length}<small> / 3</small></strong><span>empréstimos ativos</span></div><div><strong>{waiting.length}</strong><span>reservas na fila</span></div><div><strong>{progress.filter(row => row.status === 'completed').length}</strong><span>leituras concluídas</span></div></div>
        {active.some(loan => isOverdue(loan)) && <p className={styles.overdueNotice}>Você tem um livro em atraso. Confira o prazo abaixo e registre a devolução.</p>}
        <div className={styles.libraryTabs} role="group" aria-label="Seções da sua biblioteca">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.title}<span>{item.count}</span></button>)}</div>
        {!count ? <div className={styles.empty}><BookOpen size={38} /><h2>{tab === 'history' ? 'Seu histórico começa na primeira devolução' : tab === 'reading' ? 'Organize suas próximas leituras' : tab === 'reservations' ? 'Nenhuma reserva em espera' : 'Nenhum empréstimo ativo'}</h2><p>{tab === 'reading' ? 'Abra um livro e registre se sua leitura está em andamento ou concluída.' : 'Explore o catálogo e escolha sua próxima leitura.'}</p><Link to="/" className={styles.primary}>Explorar catálogo</Link></div>
          : <div className={styles.libraryList}>{(tab === 'active' ? active : tab === 'history' ? history : []).map(loan => <LoanRow key={`${reader.uid}:${loan.id}`} loan={loan} />)}
            {tab === 'reservations' && waiting.map(row => <ReservationRow key={`${reader.uid}:${row.id}`} reservation={row} />)}
            {tab === 'reading' && progress.map(row => <article className={styles.libraryRow} key={`${reader.uid}:${row.workId}`}><LibraryBook workId={row.workId} book={row.book} /><ReadingControl book={asBook(row.workId, row.book)} status={row.status} /></article>)}
          </div>}
      </>}
  </>;
}
