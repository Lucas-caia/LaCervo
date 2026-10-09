// Vite supplies public configuration at build time; private credentials never belong here.
export const runtimeConfig = {
  openLibraryUrl: import.meta.env.VITE_OPEN_LIBRARY_URL || 'https://openlibrary.org',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  },
  useEmulators: import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
};
