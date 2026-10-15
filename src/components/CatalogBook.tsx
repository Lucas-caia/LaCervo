import { useAppSelector } from '../app/store';
import { useCopy } from '../app/useCirculation';
import type { Book } from '../domain/models';
import { hasDigitalEdition } from '../domain/wikisource';
import BookCard from './BookCard';

export default function CatalogBook({ book }: { book: Book }) {
  const reader = useAppSelector(state => state.session.reader);
  const { copy, loading, error } = useCopy(book.id, hasDigitalEdition(book));
  if (!hasDigitalEdition(book)) return <BookCard book={book} loanStatus="Empréstimo indisponível" />;
  let loanStatus = 'Empréstimos: entre para consultar';
  if (reader) {
    loanStatus = loading ? 'Consultando empréstimo…' : error ? 'Disponibilidade não confirmada'
      : copy?.activeLoanId ? 'Emprestado · aceita reserva'
      : copy?.reservedForUserId && copy.reservedForUserId !== reader.uid ? 'Reservado · aguarde a fila'
      : 'Disponível para empréstimo';
  }
  return <BookCard book={book} loanStatus={loanStatus} />;
}
