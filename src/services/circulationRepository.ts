import { arrayRemove, arrayUnion, collection, doc, runTransaction, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { Book, BookSummary, ReadingStatus } from '../domain/models';
import { initialDigitalCopy, isWikiBook } from '../domain/wikisource';

export function bookSummary(book: Book): BookSummary {
  return { title: book.title.slice(0, 300), authors: book.authors.slice(0, 4).map(name => name.slice(0, 150)), coverId: book.coverId };
}

// Security Rules independently validate every transition and its companion documents.
export function createCirculationRepository(db: Firestore, getUserId: () => string | null) {
  function userId() {
    const uid = getUserId();
    if (!uid) throw new Error('Entre na sua conta para continuar.');
    return uid;
  }
  function workId(id: string) {
    if (!/^(OL\d+W|WS[1-9]\d{0,11})$/.test(id)) throw new Error('Livro inválido.');
    return id;
  }
  return {
    async borrow(id: string, book?: Book) {
      const uid = userId();
      if (!isWikiBook(id)) throw new Error('Escolha uma edição da Wikisource para solicitar um novo empréstimo.');
      const copyRef = doc(db, 'copies', workId(id));
      const accountRef = doc(db, 'readerAccounts', uid);
      const loanRef = doc(collection(db, 'loans'));
      const reservationRef = doc(db, 'reservations', `${uid}_${id}`);
      await runTransaction(db, async tx => {
        const [copySnap, accountSnap, reservationSnap] = await Promise.all([tx.get(copyRef), tx.get(accountRef), tx.get(reservationRef)]);
        const copy = copySnap.exists() ? copySnap.data() : book?.id === id ? initialDigitalCopy(book) : null;
        if (!copy) throw new Error('Este livro ainda não possui exemplar cadastrado na biblioteca.');
        const ids: string[] = accountSnap.data()?.activeLoanIds || [];
        const queue: string[] = copy.queue || [];
        if (copy.activeLoanId) throw new Error('O exemplar já está emprestado. Você pode reservá-lo.');
        if (queue.length && queue[0] !== uid) throw new Error('Este exemplar está aguardando o primeiro leitor da fila.');
        if (ids.length >= 3) throw new Error('Você já tem três empréstimos ativos. Devolva um livro antes de solicitar outro.');
        tx.set(loanRef, { userId: uid, workId: id, book: copy.book, borrowedAt: serverTimestamp(), returnedAt: null });
        tx.set(accountRef, { activeLoanIds: arrayUnion(loanRef.id) }, { merge: true });
        if (copySnap.exists()) tx.update(copyRef, { activeLoanId: loanRef.id, queue: arrayRemove(uid) });
        else tx.set(copyRef, { workId: id, book: copy.book, activeLoanId: loanRef.id, queue: [] });
        if (queue[0] === uid && reservationSnap.exists()) tx.update(reservationRef, { status: 'fulfilled' });
      });
    },
    async returnLoan(id: string) {
      const uid = userId();
      const loanRef = doc(db, 'loans', id);
      const accountRef = doc(db, 'readerAccounts', uid);
      await runTransaction(db, async tx => {
        const [loanSnap, accountSnap] = await Promise.all([tx.get(loanRef), tx.get(accountRef)]);
        if (!loanSnap.exists() || loanSnap.data().userId !== uid) throw new Error('Empréstimo não encontrado.');
        const loan = loanSnap.data();
        if (loan.returnedAt) throw new Error('Este empréstimo já foi devolvido.');
        const copyRef = doc(db, 'copies', loan.workId);
        const copySnap = await tx.get(copyRef);
        if (copySnap.data()?.activeLoanId !== id) throw new Error('O empréstimo foi alterado. Atualize a página.');
        tx.update(loanRef, { returnedAt: serverTimestamp() });
        if (!accountSnap.data()?.activeLoanIds.includes(id)) throw new Error('O empréstimo foi alterado. Atualize a página.');
        tx.update(accountRef, { activeLoanIds: arrayRemove(id) });
        // Leaving the queue intact gives its first reader exclusive borrowing priority.
        const eventId = doc(collection(copyRef, 'availability')).id;
        tx.update(copyRef, { activeLoanId: null, availabilityEventId: eventId });
        tx.set(doc(db, 'copies', loan.workId, 'availability', eventId), { workId: loan.workId, book: copySnap.data()!.book,
          eligibleUserId: copySnap.data()!.queue[0] || null, createdAt: serverTimestamp() });
      });
    },
    async reserve(id: string) {
      const uid = userId();
      const copyRef = doc(db, 'copies', workId(id));
      const reservationRef = doc(db, 'reservations', `${uid}_${id}`);
      await runTransaction(db, async tx => {
        const copySnap = await tx.get(copyRef);
        if (!copySnap.exists() || !copySnap.data().activeLoanId) throw new Error('Só é possível reservar um exemplar emprestado.');
        const copy = copySnap.data();
        const accountSnap = await tx.get(doc(db, 'readerAccounts', uid));
        if ((accountSnap.data()?.activeLoanIds || []).includes(copy.activeLoanId)) throw new Error('Você já está com este livro emprestado.');
        if (copy.queue.includes(uid)) throw new Error('Você já possui uma reserva para este livro.');
        if (copy.queue.length >= 100) throw new Error('A fila deste livro está cheia. Tente novamente mais tarde.');
        tx.update(copyRef, { queue: arrayUnion(uid) });
        tx.set(reservationRef, { userId: uid, workId: id, book: copy.book, createdAt: serverTimestamp(), status: 'waiting' });
      });
    },
    async cancelReservation(id: string) {
      const uid = userId();
      const reservationRef = doc(db, 'reservations', id);
      await runTransaction(db, async tx => {
        const reservationSnap = await tx.get(reservationRef);
        if (!reservationSnap.exists() || reservationSnap.data().userId !== uid) throw new Error('Reserva não encontrada.');
        const reservation = reservationSnap.data();
        const copyRef = doc(db, 'copies', reservation.workId);
        const copySnap = await tx.get(copyRef);
        if (reservation.status !== 'waiting' || !copySnap.data()?.queue.includes(uid)) throw new Error('Esta reserva já foi encerrada.');
        tx.update(reservationRef, { status: 'cancelled' });
        const copy = copySnap.data()!;
        const announce = !copy.activeLoanId && copy.queue[0] === uid;
        const eventId = doc(collection(copyRef, 'availability')).id;
        tx.update(copyRef, { queue: arrayRemove(uid), ...(announce ? { availabilityEventId: eventId } : {}) });
        if (announce) tx.set(doc(db, 'copies', reservation.workId, 'availability', eventId), {
          workId: reservation.workId, book: copy.book, eligibleUserId: copy.queue.filter((value: string) => value !== uid)[0] || null, createdAt: serverTimestamp()
        });
      });
    },
    async setReadingProgress(book: Book, status: ReadingStatus) {
      const uid = userId();
      await setDoc(doc(db, 'readingProgress', `${uid}_${workId(book.id)}`), {
        userId: uid, workId: book.id, book: bookSummary(book), status, updatedAt: serverTimestamp()
      });
    }
  };
}
