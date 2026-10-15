import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { createCirculationRepository } from '../src/services/circulationRepository';
import { createReaderExtrasRepository } from '../src/services/readerExtrasRepository';
import { digitalBooks } from '../src/test/fixtures';

let env: RulesTestEnvironment;
const book = digitalBooks[0], id = book.id;
const client = (uid: string) => env.authenticatedContext(uid).firestore();
const extras = (uid: string) => createReaderExtrasRepository(client(uid), () => uid);
const circulation = (uid: string) => createCirculationRepository(client(uid), () => uid);
const ownRows = (uid: string, name: string) => getDocs(query(collection(client(uid), name), where('userId', '==', uid)));
async function returnBook(uid: string) {
  const loans = await ownRows(uid, 'loans');
  await circulation(uid).returnLoan(loans.docs.find(row => !row.data().returnedAt)!.id);
  return (await getDoc(doc(client(uid), 'copies', id))).data()!.availabilityEventId as string;
}
async function eventData(eventId: string) { return (await getDoc(doc(client('alice'), 'copies', id, 'availability', eventId))).data()!; }
function notice(uid: string, eventId: string, event: any) {
  return { userId: uid, workId: id, eventId, book: event.book, occurredAt: event.createdAt, createdAt: serverTimestamp(), readAt: null };
}
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-lacervo', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env?.cleanup(); });

describe('wishlist and durable availability notifications', () => {
  it('saves digital and reference books once, preserving the original creation date', async () => {
    await Promise.all([extras('bob').addWish(book), extras('bob').addWish(book)]);
    const initial = (await getDoc(doc(client('bob'), 'wishlist', `bob_${id}`))).data()!;
    await extras('bob').addWish(book);
    expect((await getDoc(doc(client('bob'), 'wishlist', `bob_${id}`))).data()!.createdAt).toEqual(initial.createdAt);
    await extras('bob').addWish({ ...book, id: 'OL1W', source: undefined, readable: false });
    const rows = await ownRows('bob', 'wishlist');
    expect(rows.size).toBe(2);
    expect(rows.docs.find(row => row.data().workId === 'OL1W')!.data().digital).toBe(false);
    await extras('bob').removeWish(id);
    expect((await ownRows('bob', 'wishlist')).size).toBe(1);
  });
  it('isolates wishlist data and denies guests, forged owners and invalid digital references', async () => {
    await extras('bob').addWish(book);
    const ref = doc(client('alice'), 'wishlist', `bob_${id}`);
    await assertFails(getDoc(ref)); await assertFails(deleteDoc(ref));
    await assertFails(getDocs(collection(client('bob'), 'wishlist')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'wishlist', `bob_${id}`)));
    await assertFails(setDoc(doc(client('bob'), 'wishlist', 'bob_OL1W'), { userId: 'bob', workId: 'OL1W', book: { title: 'Reference', authors: [], coverId: null }, digital: true, createdAt: serverTimestamp() }));
  });
  it('replays an event after an offline reader returns, deduplicates it and persists the read state', async () => {
    await extras('bob').addWish(book);
    await circulation('alice').borrow(id, book);
    const event = await returnBook('alice');
    // The book can be taken again before the observer returns; the historical event remains intact.
    await circulation('carol').borrow(id);
    await Promise.all([extras('bob').recordAvailability(id, event), extras('bob').recordAvailability(id, event)]);
    let rows = await ownRows('bob', 'notifications'); expect(rows.size).toBe(1);
    const noticeId = rows.docs[0].id;
    expect(rows.docs[0].data().readAt).toBeNull();
    await extras('bob').markRead(noticeId); await extras('bob').markRead(noticeId);
    await extras('bob').recordAvailability(id, event);
    rows = await ownRows('bob', 'notifications'); expect(rows.size).toBe(1);
    expect(rows.docs[0].data().readAt.toDate()).toBeInstanceOf(Date);
  });
  it('announces FIFO priority changes only to eligible readers, then announces an open queue', async () => {
    for (const uid of ['bob', 'carol', 'diana']) await extras(uid).addWish(book);
    await circulation('alice').borrow(id, book);
    await circulation('bob').reserve(id); await circulation('carol').reserve(id);
    const first = await returnBook('alice');
    for (const uid of ['bob', 'carol', 'diana']) await extras(uid).recordAvailability(id, first);
    expect((await ownRows('bob', 'notifications')).size).toBe(1);
    expect((await ownRows('carol', 'notifications')).size).toBe(0);
    expect((await ownRows('diana', 'notifications')).size).toBe(0);
    const firstData = await eventData(first);
    await assertFails(setDoc(doc(client('diana'), 'notifications', `diana_${id}_${first}`), notice('diana', first, firstData)));
    await circulation('bob').cancelReservation(`bob_${id}`);
    const second = (await getDoc(doc(client('carol'), 'copies', id))).data()!.availabilityEventId;
    await extras('carol').recordAvailability(id, second);
    expect((await ownRows('carol', 'notifications')).size).toBe(1);
    await circulation('carol').cancelReservation(`carol_${id}`);
    const third = (await getDoc(doc(client('diana'), 'copies', id))).data()!.availabilityEventId;
    await extras('diana').recordAvailability(id, third);
    expect((await ownRows('diana', 'notifications')).size).toBe(1);
  });
  it('creates a new notification for a new availability period without resetting earlier read notices', async () => {
    await extras('bob').addWish(book);
    await circulation('alice').borrow(id, book); const first = await returnBook('alice');
    await extras('bob').recordAvailability(id, first);
    await extras('bob').markRead((await ownRows('bob', 'notifications')).docs[0].id);
    await circulation('alice').borrow(id); const second = await returnBook('alice');
    await extras('bob').recordAvailability(id, second);
    const rows = await ownRows('bob', 'notifications');
    expect(rows.size).toBe(2); expect(rows.docs.filter(row => !row.data().readAt)).toHaveLength(1);
  });
  it('rejects fabricated, modified or deleted availability events', async () => {
    await circulation('alice').borrow(id, book);
    await assertFails(setDoc(doc(client('bob'), 'copies', id, 'availability', 'fake'), { workId: id, book: { title: book.title, authors: book.authors, coverId: null }, eligibleUserId: null, createdAt: serverTimestamp() }));
    const event = await returnBook('alice');
    await assertFails(updateDoc(doc(client('bob'), 'copies', id, 'availability', event), { eligibleUserId: 'bob' }));
    await assertFails(deleteDoc(doc(client('bob'), 'copies', id, 'availability', event)));
  });
  it('requires a pre-existing wish and refuses forged content, dates and notification owners', async () => {
    await extras('bob').addWish(book);
    await circulation('alice').borrow(id, book); const event = await returnBook('alice'), data = await eventData(event);
    await assertFails(setDoc(doc(client('carol'), 'notifications', `carol_${id}_${event}`), notice('carol', event, data)));
    await extras('carol').addWish(book);
    await extras('carol').recordAvailability(id, event);
    expect((await ownRows('carol', 'notifications')).size).toBe(0);
    await assertFails(setDoc(doc(client('carol'), 'notifications', `carol_${id}_${event}`), notice('carol', event, data)));
    await assertFails(setDoc(doc(client('bob'), 'notifications', `bob_${id}_${event}`), { ...notice('bob', event, data), book: { title: 'Forged', authors: [], coverId: null } }));
    await assertFails(setDoc(doc(client('bob'), 'notifications', `alice_${id}_${event}`), { ...notice('bob', event, data), userId: 'alice' }));
  });
  it('isolates notifications and allows only the owner to mark them read', async () => {
    await extras('bob').addWish(book);
    await circulation('alice').borrow(id, book); const event = await returnBook('alice');
    await extras('bob').recordAvailability(id, event);
    const noticeId = (await ownRows('bob', 'notifications')).docs[0].id;
    await assertFails(getDoc(doc(client('alice'), 'notifications', noticeId)));
    await assertFails(updateDoc(doc(client('alice'), 'notifications', noticeId), { readAt: serverTimestamp() }));
    await assertFails(getDocs(collection(client('bob'), 'notifications')));
    await assertFails(updateDoc(doc(client('bob'), 'notifications', noticeId), { book: { title: 'Changed', authors: [], coverId: null } }));
    await extras('bob').markRead(noticeId);
    await assertFails(updateDoc(doc(client('bob'), 'notifications', noticeId), { readAt: null }));
  });
});

it('stops creating notices after a wish is removed and keeps existing read history', async () => {
  await extras('bob').addWish(book);
  await circulation('alice').borrow(id, book); const first = await returnBook('alice');
  await extras('bob').recordAvailability(id, first);
  const original = (await ownRows('bob', 'notifications')).docs[0];
  await extras('bob').markRead(original.id); await extras('bob').removeWish(id);
  await circulation('alice').borrow(id); const second = await returnBook('alice');
  await extras('bob').recordAvailability(id, second);
  expect((await ownRows('bob', 'notifications')).size).toBe(1);
  expect((await getDoc(original.ref)).data()!.readAt).not.toBeNull();
  await assertFails(setDoc(doc(client('bob'), 'notifications', `bob_${id}_${second}`), notice('bob', second, await eventData(second))));
});
