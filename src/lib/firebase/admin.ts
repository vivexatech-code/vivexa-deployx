/**
 * Firebase Admin SDK Initialization & Server-side Authentication
 * Safe strictly for Server Components and Route Handlers.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseApp: any = null;
let adminDb: any = null;
let adminAuth: any = null;

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')
  );
}

function adminEmailAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getAdminServices() {
  if (adminDb && adminAuth) {
    return { adminDb, adminAuth };
  }

  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local.'
    );
  }

  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
  } else {
    let config: any = {};
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not read firebase-applet-config.json:', e);
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || config.projectId;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL as string;
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY as string).replace(/\\n/g, '\n');

    firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const firestoreDatabaseId =
    process.env.FIRESTORE_DATABASE_ID?.trim() ||
    (() => {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          return String(config.firestoreDatabaseId || '').trim();
        }
      } catch {
        /* ignore */
      }
      return '';
    })();

  adminDb =
    firestoreDatabaseId && firestoreDatabaseId !== '(default)'
      ? getFirestore(firebaseApp, firestoreDatabaseId)
      : getFirestore(firebaseApp);
  adminAuth = getAuth(firebaseApp);

  return { adminDb, adminAuth };
}

/**
 * Server-side request authenticator for Next.js Route Handlers.
 * Accepts only a verified Firebase ID token.
 */
export async function authenticateApiRequest(
  req: Request
): Promise<{ uid: string; email?: string; role: 'user' | 'admin' } | null> {
  if (!isAdminConfigured()) {
    return null;
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.substring(7).trim();
  if (idToken.split('.').length !== 3) {
    return null;
  }

  try {
    const { adminDb, adminAuth } = getAdminServices();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || '';

    let role: 'user' | 'admin' = 'user';
    if (email && adminEmailAllowlist().has(email.toLowerCase())) {
      role = 'admin';
    } else {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        role = 'admin';
      }
    }

    return { uid, email, role };
  } catch (err: any) {
    console.warn('Firebase ID token verification failed:', err.message);
    return null;
  }
}
