import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Drive AppData Scope (Narrowest possible scope for private app configuration)
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const provider = new GoogleAuthProvider();
provider.addScope(DRIVE_APPDATA_SCOPE);
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to track interactive sign-in flow
let isSigningIn = false;

// Cache the access token strictly in memory per Workspace Integration security rules
let cachedAccessToken: string | null = null;
let currentAuthUser: User | null = null;

export interface AuthStateListenerCallbacks {
  onSuccess: (user: User, accessToken: string) => void;
  onLoggedOut: () => void;
  onTokenExpired?: () => void;
}

/**
 * Initialize Firebase Auth state listener.
 * Call this on application startup.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentAuthUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is signed in from a previous session, but access token needs interactive refresh
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Perform interactive Google Sign-In via popup
 * @param emailHint Optional email address (e.g. user@gmail.com) to target or pre-fill in Google's chooser
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

    cachedAccessToken = credential.accessToken;
    currentAuthUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve cached in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Get currently authenticated user object
 */
export const getCurrentUser = (): User | null => {
  return currentAuthUser || auth.currentUser;
};

/**
 * Sign out user and purge in-memory credentials
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    currentAuthUser = null;
  }
};
