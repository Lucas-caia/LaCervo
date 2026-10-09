import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { runtimeConfig } from './runtimeConfig';

const config = runtimeConfig.firebase;

export const firebaseConfigured = Object.values(config).every(value => typeof value === 'string' && value.trim().length > 0);
// Never initialize a fake project or simulate successful authentication.
export const firebaseApp = firebaseConfigured ? initializeApp(config) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const useEmulators = runtimeConfig.useEmulators;
if (auth && useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
