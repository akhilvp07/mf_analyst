import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  User 
} from 'firebase/auth';
import firebaseConfig from './firebaseConfig';

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure persistent authentication across browser reloads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase setPersistence notice:', err);
});

// Google Drive AppData Scope (Narrowest possible scope for private app configuration)
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// Storage keys for persisting session access tokens
const TOKEN_KEY = 'mftracker_drive_access_token';
const TOKEN_EXPIRY_KEY = 'mftracker_drive_token_expiry';

// Flag to track interactive sign-in flow
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentAuthUser: User | null = null;

/**
 * Persist the OAuth access token for the duration of the session
 */
export const saveSessionToken = (token: string, expiresInSeconds: number = 3600): void => {
  cachedAccessToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    const expiryTime = Date.now() + Math.max(300, expiresInSeconds - 60) * 1000;
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
  } catch (e) {
    console.warn('Storage write error for token:', e);
  }
};

/**
 * Retrieve stored token if still within validity window
 */
export const getStoredSessionToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    const expStr = sessionStorage.getItem(TOKEN_EXPIRY_KEY) || localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token) {
      if (expStr && Number(expStr) > Date.now()) {
        cachedAccessToken = token;
        return token;
      }
      // If token expired, clear from storage
      clearSessionToken();
    }
  } catch (e) {
    // Storage access restricted or disabled
  }
  return null;
};

/**
 * Purge stored access token
 */
export const clearSessionToken = (): void => {
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {
    // Storage access restricted or disabled
  }
};

/**
 * Initialize Firebase Auth state listener and restore session smoothly across page reloads.
 *
 * @param onAuthSuccess Called when user and valid Drive access token are present
 * @param onUserRestored Called when Firebase user is restored across reloads, keeping login intact
 * @param onSignedOut Called when user is completely signed out
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onUserRestored?: (user: User) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentAuthUser = user;
    if (user) {
      const token = getStoredSessionToken();
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        // User is authenticated in Firebase across page reloads!
        // Retain the user identity so they are NOT logged out or prompted repeatedly.
        if (onUserRestored) {
          onUserRestored(user);
        } else if (onAuthSuccess) {
          onAuthSuccess(user, '');
        }
      }
    } else {
      clearSessionToken();
      if (onSignedOut) onSignedOut();
    }
  });
};

/**
 * Perform interactive Google Sign-In via popup
 * @param emailHint Optional email address to target or pre-fill in Google's chooser
 */
export const googleSignIn = async (emailHint?: string): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const dynamicProvider = new GoogleAuthProvider();
    dynamicProvider.addScope(DRIVE_APPDATA_SCOPE);
    
    const params: Record<string, string> = {
      prompt: 'select_account'
    };
    if (emailHint && emailHint.trim().length > 0) {
      params.login_hint = emailHint.trim();
    }
    dynamicProvider.setCustomParameters(params);

    const result = await signInWithPopup(auth, dynamicProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive OAuth access token from authentication response.');
    }

    saveSessionToken(credential.accessToken);
    currentAuthUser = result.user;
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve cached or stored access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  return getStoredSessionToken();
};

/**
 * Get currently authenticated user object
 */
export const getCurrentUser = (): User | null => {
  return currentAuthUser || auth.currentUser;
};

/**
 * Sign out user and purge stored credentials
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    clearSessionToken();
    currentAuthUser = null;
  }
};
