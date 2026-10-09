import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { createCirculationRepository } from '../src/services/circulationRepository';

let env: RulesTestEnvironment;
const book = { title: 'Livro de teste', authors: ['Autor'], coverId: null };
const client = (uid: string) => env.authenticatedContext(uid).firestore();
const repo = (uid: string) => createCirculationRepository(client(uid), () => uid);

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-lacervo', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (let index = 1; index <= 5; index++) await setDoc(doc(context.firestore(), 'copies', `OL${index}W`), { workId: `OL${index}W`, book, activeLoanId: null, queue: [] });
  });
});
afterAll(async () => { await env?.cleanup(); });

async function activeLoan(uid: string, workId: string) {
  const loans = await getDocs(query(collection(client(uid), 'loans'), where('userId', '==', uid)));
  return loans.docs.find(row => row.data().workId === workId && !row.data().returnedAt)!;
}

describe('Firestore circulation and authorization', () => {
  it('borrows, records a server date and returns without deleting history', async () => {
    await repo('alice').borrow('OL1W');
    const loan = await activeLoan('alice', 'OL1W');
    expect(loan.data().borrowedAt.toDate()).toBeInstanceOf(Date);
    expect(loan.data().book).toEqual(book);
    await repo('alice').returnLoan(loan.id);
    expect((await getDoc(loan.ref)).data()?.returnedAt.toDate()).toBeInstanceOf(Date);
    expect((await getDoc(doc(client('alice'), 'readerAccounts', 'alice'))).data()?.activeLoanIds).toEqual([]);
    expect((await getDoc(doc(client('alice'), 'copies', 'OL1W'))).data()?.activeLoanId).toBeNull();
  });
  it('accepts only one concurrent request for the same copy', async () => {
    const results = await Promise.allSettled([repo('alice').borrow('OL1W'), repo('bob').borrow('OL1W')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
  it('enforces the three-loan limit even with concurrent requests across different books', async () => {
    const results = await Promise.allSettled([1, 2, 3, 4].map(index => repo('alice').borrow(`OL${index}W`)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    const account = await getDoc(doc(client('alice'), 'readerAccounts', 'alice'));
    expect(account.data()?.activeLoanIds).toHaveLength(3);
  });
  it('preserves FIFO priority on return and cancellation, then fulfills the reservation', async () => {
    await repo('alice').borrow('OL1W');
    await repo('bob').reserve('OL1W');
    await repo('carol').reserve('OL1W');
    await repo('alice').returnLoan((await activeLoan('alice', 'OL1W')).id);
    await expect(repo('carol').borrow('OL1W')).rejects.toThrow();
    await repo('bob').cancelReservation('bob_OL1W');
    await repo('carol').borrow('OL1W');
    expect((await getDoc(doc(client('carol'), 'reservations', 'carol_OL1W'))).data()?.status).toBe('fulfilled');
    expect((await getDoc(doc(client('carol'), 'copies', 'OL1W'))).data()?.queue).toEqual([]);
    await repo('bob').reserve('OL1W');
    expect((await getDoc(doc(client('bob'), 'reservations', 'bob_OL1W'))).data()?.status).toBe('waiting');
  });
  it('rejects duplicate reservations, own loans and reservation of an available book', async () => {
    await expect(repo('bob').reserve('OL1W')).rejects.toThrow();
    await repo('alice').borrow('OL1W');
    await expect(repo('alice').reserve('OL1W')).rejects.toThrow();
    await repo('bob').reserve('OL1W');
    await expect(repo('bob').reserve('OL1W')).rejects.toThrow();
  });
  it('denies guests, other readers history, inventory creation and isolated writes', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'copies', 'OL1W')));
    await repo('alice').borrow('OL1W');
    const loan = await activeLoan('alice', 'OL1W');
    await assertFails(getDoc(doc(client('bob'), 'loans', loan.id)));
    await assertFails(updateDoc(doc(client('bob'), 'loans', loan.id), { returnedAt: serverTimestamp() }));
    await assertFails(updateDoc(loan.ref, { returnedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(client('alice'), 'copies', 'OL1W'), { activeLoanId: null }));
    await assertFails(setDoc(doc(client('alice'), 'readerAccounts', 'alice'), { activeLoanIds: [] }));
    await assertFails(setDoc(doc(client('alice'), 'copies', 'OL99W'), { workId: 'OL99W', book, activeLoanId: null, queue: [] }));
    await assertFails(updateDoc(doc(client('alice'), 'copies', 'OL1W'), { book: { ...book, title: 'Tampered' } }));
  });
  it('rejects a forged fourth loan sent without the application checks', async () => {
    await repo('alice').borrow('OL1W'); await repo('alice').borrow('OL2W'); await repo('alice').borrow('OL3W');
    const db = client('alice');
    const account = (await getDoc(doc(db, 'readerAccounts', 'alice'))).data()!;
    const batch = writeBatch(db);
    batch.set(doc(db, 'loans', 'forged'), { userId: 'alice', workId: 'OL4W', book, borrowedAt: serverTimestamp(), returnedAt: null });
    batch.update(doc(db, 'copies', 'OL4W'), { activeLoanId: 'forged' });
    batch.update(doc(db, 'readerAccounts', 'alice'), { activeLoanIds: [...account.activeLoanIds, 'forged'] });
    await assertFails(batch.commit());
  });
  it('denies queue jumping and cancellation of another reader reservation', async () => {
    await repo('alice').borrow('OL1W'); await repo('bob').reserve('OL1W'); await repo('carol').reserve('OL1W');
    await assertFails(updateDoc(doc(client('carol'), 'copies', 'OL1W'), { queue: ['carol', 'bob'] }));
    await assertFails(updateDoc(doc(client('carol'), 'reservations', 'bob_OL1W'), { status: 'cancelled' }));
    await assertFails(updateDoc(doc(client('bob'), 'reservations', 'bob_OL1W'), { status: 'cancelled' }));
  });
  it('persists reading status independently of loans and validates ownership and input', async () => {
    const fullBook = { id: 'OL1W', ...book, publicationYear: null, subjects: [] };
    await repo('alice').setReadingProgress(fullBook, 'reading');
    const reference = doc(client('alice'), 'readingProgress', 'alice_OL1W');
    await assertSucceeds(getDoc(reference));
    await repo('alice').setReadingProgress(fullBook, 'completed');
    expect((await getDoc(reference)).data()?.status).toBe('completed');
    await assertFails(getDoc(doc(client('bob'), 'readingProgress', 'alice_OL1W')));
    await assertFails(updateDoc(reference, { status: 'invalid', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { book: { ...book, authors: [{ unexpected: true }] }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(client('bob'), 'readingProgress', 'alice_OL1W'), { userId: 'alice', workId: 'OL1W', book, status: 'reading', updatedAt: serverTimestamp() }));
  });
});
