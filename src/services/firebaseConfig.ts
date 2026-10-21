/**
 * Firebase Client Configuration Loader
 * 
 * Safely resolves configuration from Vite environment variables (VITE_FIREBASE_*)
 * or falls back to local firebase-applet-config.json when available.
 * This prevents hardcoding sensitive secrets in git-tracked source files.
 */

interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
}

// Eagerly glob local config file if present in working environment.
// Using import.meta.glob prevents build-time breaks if the file is gitignored.
const localConfigFiles = import.meta.glob<{ default: Record<string, string> }>(
  '/firebase-applet-config.json',
  { eager: true }
);

const localConfig: Record<string, string> =
  localConfigFiles['/firebase-applet-config.json']?.default || {};

export const firebaseConfig: FirebaseAppConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    localConfig.apiKey ||
    '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    localConfig.authDomain ||
    '',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    localConfig.projectId ||
    '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    localConfig.storageBucket ||
    '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localConfig.messagingSenderId ||
    '',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    localConfig.appId ||
    '',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    localConfig.measurementId ||
    '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    localConfig.firestoreDatabaseId ||
    '',
  oAuthClientId:
    import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID ||
    localConfig.oAuthClientId ||
    ''
};

export default firebaseConfig;
