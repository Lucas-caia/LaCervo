import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, terminate, type Firestore } from 'firebase/firestore';
import { createCirculationRepository } from '../src/services/circulationRepository';
import { authorizeReading } from '../server/readingAccess';
import { digitalBooks } from '../src/test/fixtures';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
beforeAll(() => {
  // Never point this integration test at a production Firebase project.
  app = initializeApp({ apiKey: 'demo-lacervo-key', projectId: 'demo-lacervo', appId: 'demo-lacervo-app' }, 'authentication-tests');
  auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
});
afterAll(async () => { if (auth) await signOut(auth); if (db) await terminate(db); if (app) await deleteApp(app); });

describe('Firebase token authentication with the local REST backend', () => {
  it('authorizes reading only while a real emulator loan remains active', async () => {
    const user = await createUserWithEmailAndPassword(auth, `reading-${randomUUID()}@lacervo.test`, 'LocalTest123!');
    const repository = createCirculationRepository(db, () => auth.currentUser?.uid || null);
    await repository.borrow(digitalBooks[0].id, digitalBooks[0]);
    const account = await getDocFromServer(doc(db, 'readerAccounts', user.user.uid));
    const loanId = account.data()!.activeLoanIds[0];
    const request = { token: await user.user.getIdToken(), workId: digitalBooks[0].id, loanId,
      env: { NODE_ENV: 'development', VITE_USE_FIREBASE_EMULATORS: 'true', VITE_FIREBASE_API_KEY: 'demo-lacervo-key', VITE_FIREBASE_PROJECT_ID: 'demo-lacervo' } };
    await expect(authorizeReading(request)).resolves.toBe(user.user.uid);
    await repository.returnLoan(loanId);
    await expect(authorizeReading(request)).rejects.toMatchObject({ status: 403 });
    await signOut(auth);
  });
  it('signs in, sends an ID token to the protected REST API and clears the session on logout', async () => {
    const email = `reader-${randomUUID()}@lacervo.test`;
    const password = 'LocalTest123!';
    await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    await expect(signInWithEmailAndPassword(auth, email, 'WrongPassword123!')).rejects.toBeDefined();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;
    const repository = createCirculationRepository(db, () => auth.currentUser?.uid || null);
    await repository.setReadingProgress({ id: 'OL1W', title: 'Livro local', authors: [], coverId: null, publicationYear: null, subjects: [] }, 'reading');
    const token = await credential.user.getIdToken();
    const url = `http://127.0.0.1:8080/v1/projects/demo-lacervo/databases/(default)/documents/readingProgress/${uid}_OL1W`;
    const authenticated = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    expect(authenticated.status).toBe(200);
    expect((await authenticated.json()).fields.userId.stringValue).toBe(uid);
    const guest = await fetch(url); expect(guest.status).toBe(403);
    await signOut(auth);
    expect(auth.currentUser).toBeNull();
    await expect(getDocFromServer(doc(db, 'readingProgress', `${uid}_OL1W`))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(repository.setReadingProgress({ id: 'OL1W', title: 'Livro local', authors: [], coverId: null, publicationYear: null, subjects: [] }, 'completed')).rejects.toThrow('Entre na sua conta');
  });
});
