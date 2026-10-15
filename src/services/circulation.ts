import { collection, doc, getFirestore, onSnapshot, query, where, connectFirestoreEmulator, type Timestamp, type DocumentData } from 'firebase/firestore';
import { firebaseApp, auth, useEmulators } from './firebase';
import type { LibraryCopy, Loan, ReadingProgress, Reservation } from '../domain/models';
import { dueDate } from '../domain/policy';
import { createCirculationRepository } from './circulationRepository';

export const db = firebaseApp ? getFirestore(firebaseApp) : null;
if (db && useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
const commands = () => {
  if (!db) throw new Error('O acesso à biblioteca ainda não está disponível.');
  return createCirculationRepository(db, () => auth?.currentUser?.uid || null);
};
export const borrowBook: ReturnType<typeof createCirculationRepository>['borrow'] = (id, book) => commands().borrow(id, book);
export const returnLoan = (id: string) => commands().returnLoan(id);
export const reserveBook = (id: string) => commands().reserve(id);
export const cancelReservation = (id: string) => commands().cancelReservation(id);
export const saveReadingProgress: ReturnType<typeof createCirculationRepository>['setReadingProgress'] = (book, status) => commands().setReadingProgress(book, status);

const iso = (value: Timestamp | null | undefined) => value?.toDate?.().toISOString() || null;
export function subscribeCopy(workId: string, next: (copy: LibraryCopy | null) => void, error: (error: Error) => void) {
  if (!db) { next(null); return () => {}; }
  return onSnapshot(doc(db, 'copies', workId), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.hasPendingWrites) return;
    const data = snapshot.data();
    next(data ? { ...data, workId, reservedForUserId: !data.activeLoanId ? data.queue[0] || null : null } as LibraryCopy : null);
  }, error);
}

export interface ReaderLibrary { loans: Loan[]; reservations: Reservation[]; progress: ReadingProgress[]; }
export function subscribeReaderLibrary(uid: string, next: (library: ReaderLibrary) => void, error: (error: Error) => void) {
  if (!db) { error(new Error('Firebase indisponível')); return () => {}; }
  const library: ReaderLibrary = { loans: [], reservations: [], progress: [] };
  const loaded = new Set<string>();
  let failed = false;
  const stops = (['loans', 'reservations', 'readingProgress'] as const).map(name =>
    onSnapshot(query(collection(db, name), where('userId', '==', uid)), { includeMetadataChanges: true }, snapshot => {
      // Retain the last committed view until the server acknowledges the entire operation.
      if (failed || snapshot.metadata.hasPendingWrites) return;
      const rows = snapshot.docs.map(row => ({ ...row.data(), id: row.id } as DocumentData));
      if (name === 'loans') library.loans = rows.filter(row => iso(row.borrowedAt)).map(row => {
        const borrowedAt = iso(row.borrowedAt)!;
        return { ...row, borrowedAt, dueAt: dueDate(new Date(borrowedAt)), returnedAt: iso(row.returnedAt) } as Loan;
      }).sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt));
      if (name === 'reservations') library.reservations = rows.map(row => ({ ...row, createdAt: iso(row.createdAt) || '' } as Reservation)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (name === 'readingProgress') library.progress = rows as ReadingProgress[];
      loaded.add(name);
      if (loaded.size === 3) next({ ...library });
    }, cause => { failed = true; error(cause); }));
  return () => stops.forEach(stop => stop());
}

export { circulationError } from './errors';
