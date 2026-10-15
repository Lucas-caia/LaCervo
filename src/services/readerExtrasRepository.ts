import { doc, runTransaction, serverTimestamp, type Firestore, type Timestamp } from 'firebase/firestore';
import type { Book } from '../domain/models';
import { bookSummary } from './circulationRepository';
import { hasDigitalEdition } from '../domain/wikisource';

export function createReaderExtrasRepository(db: Firestore, getUserId: () => string | null) {
  function owner() { const uid = getUserId(); if (!uid) throw new Error('Entre na sua conta para continuar.'); return uid; }
  function work(id: string) { if (!/^(OL\d+W|WS[1-9]\d{0,11})$/.test(id)) throw new Error('Livro inválido.'); return id; }
  return {
    async addWish(book: Book) {
      const uid = owner(), ref = doc(db, 'wishlist', `${uid}_${work(book.id)}`);
      await runTransaction(db, async tx => {
        if ((await tx.get(ref)).exists()) return;
        tx.set(ref, { userId: uid, workId: book.id, book: bookSummary(book), digital: hasDigitalEdition(book), createdAt: serverTimestamp() });
      });
    },
    async removeWish(id: string) {
      const uid = owner(), ref = doc(db, 'wishlist', `${uid}_${work(id)}`);
      await runTransaction(db, async tx => { if ((await tx.get(ref)).exists()) tx.delete(ref); });
    },
    async recordAvailability(workId: string, eventId: string) {
      const uid = owner(); work(workId);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) throw new Error('Aviso inválido.');
      const wishRef = doc(db, 'wishlist', `${uid}_${workId}`);
      const eventRef = doc(db, 'copies', workId, 'availability', eventId);
      const noticeRef = doc(db, 'notifications', `${uid}_${workId}_${eventId}`);
      await runTransaction(db, async tx => {
        const [wishSnap, eventSnap, noticeSnap] = await Promise.all([tx.get(wishRef), tx.get(eventRef), tx.get(noticeRef)]);
        if (noticeSnap.exists() || !wishSnap.exists() || !eventSnap.exists()) return;
        const wish = wishSnap.data(), event = eventSnap.data();
        if (!wish.digital || event.workId !== workId || (event.eligibleUserId !== null && event.eligibleUserId !== uid)
          || (wish.createdAt as Timestamp).valueOf() > (event.createdAt as Timestamp).valueOf()) return;
        tx.set(noticeRef, { userId: uid, workId, eventId, book: event.book, occurredAt: event.createdAt, createdAt: serverTimestamp(), readAt: null });
      });
    },
    async markRead(id: string) {
      const uid = owner(), ref = doc(db, 'notifications', id);
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || snapshot.data().userId !== uid) throw new Error('Notificação não encontrada.');
        if (!snapshot.data().readAt) tx.update(ref, { readAt: serverTimestamp() });
      });
    }
  };
}
