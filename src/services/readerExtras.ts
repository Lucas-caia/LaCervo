import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import type { AvailabilityNotice, WishItem } from '../domain/models';
import { db } from './circulation';
import { auth } from './firebase';
import { createReaderExtrasRepository } from './readerExtrasRepository';

function commands() {
  if (!db) throw new Error('O acesso à biblioteca ainda não está disponível.');
  return createReaderExtrasRepository(db, () => auth?.currentUser?.uid || null);
}
export const addWish: ReturnType<typeof createReaderExtrasRepository>['addWish'] = book => commands().addWish(book);
export const removeWish = (id: string) => commands().removeWish(id);
export const markNoticeRead = (id: string) => commands().markRead(id);
const iso = (value?: Timestamp | null) => value?.toDate?.().toISOString() || null;

export function subscribeWishlist(uid: string, next: (items: WishItem[]) => void, error: (error: Error) => void) {
  if (!db) { error(new Error('O acesso à biblioteca ainda não está disponível.')); return () => {}; }
  return onSnapshot(query(collection(db, 'wishlist'), where('userId', '==', uid)), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.hasPendingWrites) return;
    next(snapshot.docs.filter(row => iso(row.data().createdAt)).map(row => ({ ...row.data(), id: row.id, createdAt: iso(row.data().createdAt)! } as WishItem))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, error);
}
export function subscribeNotices(uid: string, next: (items: AvailabilityNotice[]) => void, error: (error: Error) => void) {
  if (!db) { error(new Error('O acesso às notificações ainda não está disponível.')); return () => {}; }
  return onSnapshot(query(collection(db, 'notifications'), where('userId', '==', uid)), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.hasPendingWrites) return;
    next(snapshot.docs.filter(row => iso(row.data().occurredAt)).map(row => ({ ...row.data(), id: row.id, occurredAt: iso(row.data().occurredAt)!, readAt: iso(row.data().readAt) } as AvailabilityNotice))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id)));
  }, error);
}
export function watchAvailability(uid: string, wishes: WishItem[], error: (error: Error) => void) {
  if (!db) return () => {};
  const repository = createReaderExtrasRepository(db, () => auth?.currentUser?.uid === uid ? uid : null);
  let active = true;
  // Durable events are replayed at login, including changes that happened while the reader was away.
  const stops = wishes.filter(item => item.digital).map(item => onSnapshot(
    query(collection(db!, 'copies', item.workId, 'availability'), where('createdAt', '>=', Timestamp.fromDate(new Date(item.createdAt)))),
    snapshot => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;
        const event = change.doc.data();
        if (event.eligibleUserId !== null && event.eligibleUserId !== uid) continue;
        void repository.recordAvailability(item.workId, change.doc.id).catch(cause => { if (active) error(cause); });
      }
    }, cause => { if (active) error(cause); }
  ));
  return () => { active = false; stops.forEach(stop => stop()); };
}
