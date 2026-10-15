import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { createCirculationRepository } from '../src/services/circulationRepository';
import { digitalBooks } from '../src/test/fixtures';

let env: RulesTestEnvironment;
const book = { title: 'Livro de teste', authors: ['Autor'], coverId: null };
const client = (uid: string) => env.authenticatedContext(uid).firestore();
const repo = (uid: string) => createCirculationRepository(client(uid), () => uid);

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-lacervo', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (let index = 1; index <= 5; index++) await setDoc(doc(context.firestore(), 'copies', `WS${index}`), { workId: `WS${index}`, book, activeLoanId: null, queue: [] });
  });
});
afterAll(async () => { await env?.cleanup(); });

async function activeLoan(uid: string, workId: string) {
  const loans = await getDocs(query(collection(client(uid), 'loans'), where('userId', '==', uid)));
  return loans.docs.find(row => row.data().workId === workId && !row.data().returnedAt)!;
}

describe('Firestore circulation and authorization', () => {
  it('limits first-time dynamic editions to three concurrent loans and frees a slot on return', async () => {
    const editions = [501, 502, 503, 504].map(id => ({ ...digitalBooks[0], id: `WS${id}` }));
    const results = await Promise.allSettled(editions.map(item => repo('alice').borrow(item.id, item)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    const active = await getDocs(query(collection(client('alice'), 'loans'), where('userId', '==', 'alice')));
    const first = active.docs[0];
    await repo('alice').returnLoan(first.id);
    const failed = editions[results.findIndex(result => result.status === 'rejected')];
    await repo('alice').borrow(failed.id, failed);
    expect((await getDoc(doc(client('alice'), 'readerAccounts', 'alice'))).data()?.activeLoanIds).toHaveLength(3);
  });
  it('atomically registers a dynamic Wikisource edition, lends it and preserves reservation priority', async () => {
    const id = digitalBooks[0].id;
    await repo('alice').borrow(id, digitalBooks[0]);
    const loan = await activeLoan('alice', id);
    expect(loan.data().book.title).toBe(digitalBooks[0].title);
    await repo('bob').reserve(id);
    await repo('alice').returnLoan(loan.id);
    await expect(repo('carol').borrow(id)).rejects.toThrow();
    await repo('bob').borrow(id);
    expect((await getDoc(doc(client('bob'), 'reservations', `bob_${id}`))).data()?.status).toBe('fulfilled');
  });
  it('allows only one first loan when the public copy does not exist yet', async () => {
    const results = await Promise.allSettled([repo('alice').borrow(digitalBooks[1].id, digitalBooks[1]), repo('bob').borrow(digitalBooks[1].id, digitalBooks[1])]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('rejects standalone inventory creation and invalid metadata', async () => {
    const id = digitalBooks[2].id;
    await assertFails(setDoc(doc(client('alice'), 'copies', id), { workId: id, book: { ...book, title: digitalBooks[2].title }, activeLoanId: null, queue: [] }));
    const db = client('alice'), batch = writeBatch(db);
    batch.set(doc(db, 'copies', id), { workId: id, book: { ...book, title: '' }, activeLoanId: 'forged-public', queue: [] });
    batch.set(doc(db, 'loans', 'forged-public'), { userId: 'alice', workId: id, book, borrowedAt: serverTimestamp(), returnedAt: null });
    batch.set(doc(db, 'readerAccounts', 'alice'), { activeLoanIds: ['forged-public'] });
    await assertFails(batch.commit());
  });
  it('borrows, records a server date and returns without deleting history', async () => {
    await repo('alice').borrow('WS1');
    const loan = await activeLoan('alice', 'WS1');
    expect(loan.data().borrowedAt.toDate()).toBeInstanceOf(Date);
    expect(loan.data().book).toEqual(book);
    await repo('alice').returnLoan(loan.id);
    expect((await getDoc(loan.ref)).data()?.returnedAt.toDate()).toBeInstanceOf(Date);
    expect((await getDoc(doc(client('alice'), 'readerAccounts', 'alice'))).data()?.activeLoanIds).toEqual([]);
    expect((await getDoc(doc(client('alice'), 'copies', 'WS1'))).data()?.activeLoanId).toBeNull();
  });
  it('accepts only one concurrent request for the same copy', async () => {
    const results = await Promise.allSettled([repo('alice').borrow('WS1'), repo('bob').borrow('WS1')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('enforces the three-loan limit even with concurrent requests across different books', async () => {
    const results = await Promise.allSettled([1, 2, 3, 4].map(index => repo('alice').borrow(`WS${index}`)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    const account = await getDoc(doc(client('alice'), 'readerAccounts', 'alice'));
    expect(account.data()?.activeLoanIds).toHaveLength(3);
  });
  it('preserves FIFO priority on return and cancellation, then fulfills the reservation', async () => {
    await repo('alice').borrow('WS1');
    await repo('bob').reserve('WS1');
    await repo('carol').reserve('WS1');
    await repo('alice').returnLoan((await activeLoan('alice', 'WS1')).id);
    await expect(repo('carol').borrow('WS1')).rejects.toThrow();
    await repo('bob').cancelReservation('bob_WS1');
    await repo('carol').borrow('WS1');
    expect((await getDoc(doc(client('carol'), 'reservations', 'carol_WS1'))).data()?.status).toBe('fulfilled');
    expect((await getDoc(doc(client('carol'), 'copies', 'WS1'))).data()?.queue).toEqual([]);
    await repo('bob').reserve('WS1');
    expect((await getDoc(doc(client('bob'), 'reservations', 'bob_WS1'))).data()?.status).toBe('waiting');
  });
  it('rejects duplicate reservations, own loans and reservation of an available book', async () => {
    await expect(repo('bob').reserve('WS1')).rejects.toThrow();
    await repo('alice').borrow('WS1');
    await expect(repo('alice').reserve('WS1')).rejects.toThrow();
    await repo('bob').reserve('WS1');
    await expect(repo('bob').reserve('WS1')).rejects.toThrow();
  });
  it('denies guests, other readers history, inventory creation and isolated writes', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'copies', 'WS1')));
    await repo('alice').borrow('WS1');
    const loan = await activeLoan('alice', 'WS1');
    await assertFails(getDoc(doc(client('bob'), 'loans', loan.id)));
    await assertFails(updateDoc(doc(client('bob'), 'loans', loan.id), { returnedAt: serverTimestamp() }));
    await assertFails(updateDoc(loan.ref, { returnedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(client('alice'), 'copies', 'WS1'), { activeLoanId: null }));
    await assertFails(setDoc(doc(client('alice'), 'readerAccounts', 'alice'), { activeLoanIds: [] }));
    await assertFails(setDoc(doc(client('alice'), 'copies', 'OL99W'), { workId: 'OL99W', book, activeLoanId: null, queue: [] }));
    await assertFails(updateDoc(doc(client('alice'), 'copies', 'WS1'), { book: { ...book, title: 'Tampered' } }));
  });
  it('rejects a forged fourth loan sent without the application checks', async () => {
    await repo('alice').borrow('WS1'); await repo('alice').borrow('WS2'); await repo('alice').borrow('WS3');
    const db = client('alice');
    const account = (await getDoc(doc(db, 'readerAccounts', 'alice'))).data()!;
    const batch = writeBatch(db);
    batch.set(doc(db, 'loans', 'forged'), { userId: 'alice', workId: 'WS4', book, borrowedAt: serverTimestamp(), returnedAt: null });
    batch.update(doc(db, 'copies', 'WS4'), { activeLoanId: 'forged' });
    batch.update(doc(db, 'readerAccounts', 'alice'), { activeLoanIds: [...account.activeLoanIds, 'forged'] });
    await assertFails(batch.commit());
  });
  it('denies queue jumping and cancellation of another reader reservation', async () => {
    await repo('alice').borrow('WS1'); await repo('bob').reserve('WS1'); await repo('carol').reserve('WS1');
    await assertFails(updateDoc(doc(client('carol'), 'copies', 'WS1'), { queue: ['carol', 'bob'] }));
    await assertFails(updateDoc(doc(client('carol'), 'reservations', 'bob_WS1'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(client('bob'), 'reservations', 'bob_WS1'), { status: 'cancelled' }));
  });
  it('persists reading status independently of loans and validates ownership and input', async () => {
    const fullBook = { id: 'WS1', ...book, publicationYear: null, subjects: [] };
    await repo('alice').setReadingProgress(fullBook, 'reading');
    const reference = doc(client('alice'), 'readingProgress', 'alice_WS1');
    await assertSucceeds(getDoc(reference));
    await repo('alice').setReadingProgress(fullBook, 'completed');
    expect((await getDoc(reference)).data()?.status).toBe('completed');
    await assertFails(getDoc(doc(client('bob'), 'readingProgress', 'alice_WS1')));
    await assertFails(updateDoc(reference, { status: 'invalid', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { book: { ...book, authors: [{ unexpected: true }] }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(client('bob'), 'readingProgress', 'alice_WS1'), { userId: 'alice', workId: 'WS1', book, status: 'reading', updatedAt: serverTimestamp() }));
  });
});
