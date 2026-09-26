/**
 * Firebase Client Initialization
 * Uses provisioned credentials from firebase-applet-config.json or NEXT_PUBLIC environment variables.
 * Safe for use in Client Components.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigFile from '../../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigFile.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigFile.appId,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * This Firebase project uses a named Firestore database (no "(default)" DB).
 * Prefer NEXT_PUBLIC_FIRESTORE_DATABASE_ID, then the applet config id.
 */
function resolveFirestoreDatabaseId(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  if (fromEnv && fromEnv !== '(default)') return fromEnv;
  const fromFile = String(firebaseConfigFile.firestoreDatabaseId || '').trim();
  if (fromFile && fromFile !== '(default)') return fromFile;
  return undefined;
}

const firestoreDatabaseId = resolveFirestoreDatabaseId();
export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);
