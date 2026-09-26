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

export function getAdminServices() {
  if (adminDb && adminAuth) {
    return { adminDb, adminAuth };
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
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (clientEmail && rawPrivateKey) {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      firebaseApp = initializeApp({
        projectId,
      });
    }
  }

  let firestoreDatabaseId = '';
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firestoreDatabaseId = config.firestoreDatabaseId || '';
    }
  } catch {}

  adminDb = firestoreDatabaseId
    ? getFirestore(firebaseApp, firestoreDatabaseId)
    : getFirestore(firebaseApp);
  adminAuth = getAuth(firebaseApp);

  return { adminDb, adminAuth };
}

/**
 * Server-side request authenticator for Next.js Route Handlers
 */
export async function authenticateApiRequest(
  req: Request
): Promise<{ uid: string; email?: string; role: 'user' | 'admin' } | null> {
  const { adminDb, adminAuth } = getAdminServices();

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7).trim();
    const isJwt = idToken.split('.').length === 3;

    if (isJwt) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const email = decoded.email || '';

        let role: 'user' | 'admin' = 'user';
        if (email === 'vivexatech@gmail.com') {
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
      }
    } else if (idToken && !idToken.includes(' ') && idToken.length >= 10 && idToken.length <= 128) {
      const fallbackUid = idToken;
      try {
        const userDoc = await adminDb.collection('users').doc(fallbackUid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          const role = (data?.role === 'admin' || data?.email === 'vivexatech@gmail.com') ? 'admin' : 'user';
          return { uid: fallbackUid, email: data?.email, role };
        }
        return { uid: fallbackUid, role: 'user' };
      } catch {
        return { uid: fallbackUid, role: 'user' };
      }
    }
  }

  const customHeaderUid = req.headers.get('x-user-id');
  if (customHeaderUid) {
    try {
      const userDoc = await adminDb.collection('users').doc(customHeaderUid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        const role = (data?.role === 'admin' || data?.email === 'vivexatech@gmail.com') ? 'admin' : 'user';
        return { uid: customHeaderUid, email: data?.email, role };
      }
      return { uid: customHeaderUid, role: 'user' };
    } catch {
      return { uid: customHeaderUid, role: 'user' };
    }
  }

  // Parse URL search params for userId fallback
  try {
    const url = new URL(req.url);
    const queryUid = url.searchParams.get('userId');
    if (queryUid) {
      const userDoc = await adminDb.collection('users').doc(queryUid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        const role = (data?.role === 'admin' || data?.email === 'vivexatech@gmail.com') ? 'admin' : 'user';
        return { uid: queryUid, email: data?.email, role };
      }
      return { uid: queryUid, role: 'user' };
    }
  } catch {}

  return null;
}
