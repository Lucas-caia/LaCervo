import { arrayRemove, arrayUnion, collection, doc, runTransaction, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { Book, BookSummary, ReadingStatus } from '../domain/models';

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
    if (!/^OL\d+W$/.test(id)) throw new Error('Livro inválido.');
    return id;
  }
  return {
    async borrow(id: string) {
      const uid = userId();
      const copyRef = doc(db, 'copies', workId(id));
      const accountRef = doc(db, 'readerAccounts', uid);
      const loanRef = doc(collection(db, 'loans'));
      const reservationRef = doc(db, 'reservations', `${uid}_${id}`);
      await runTransaction(db, async tx => {
        const [copySnap, accountSnap, reservationSnap] = await Promise.all([tx.get(copyRef), tx.get(accountRef), tx.get(reservationRef)]);
        if (!copySnap.exists()) throw new Error('Este livro ainda não possui exemplar cadastrado na biblioteca.');
        const copy = copySnap.data();
        const ids: string[] = accountSnap.data()?.activeLoanIds || [];
        const queue: string[] = copy.queue;
        if (copy.activeLoanId) throw new Error('O exemplar já está emprestado. Você pode reservá-lo.');
        if (queue.length && queue[0] !== uid) throw new Error('Este exemplar está aguardando o primeiro leitor da fila.');
        if (ids.length >= 3) throw new Error('Você já tem três empréstimos ativos. Devolva um livro antes de solicitar outro.');
        tx.set(loanRef, { userId: uid, workId: id, book: copy.book, borrowedAt: serverTimestamp(), returnedAt: null });
        tx.set(accountRef, { activeLoanIds: arrayUnion(loanRef.id) }, { merge: true });
        tx.update(copyRef, { activeLoanId: loanRef.id, queue: arrayRemove(uid) });
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
        tx.update(copyRef, { activeLoanId: null });
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
        tx.update(copyRef, { queue: arrayRemove(uid) });
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
