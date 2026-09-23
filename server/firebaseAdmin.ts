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
    // Read config
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

  // Handle custom firestoreDatabaseId if configured
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
 * Verify user from Authorization header (Bearer Firebase ID token) or fallback to x-user-id header
 */
export async function authenticateRequest(req: any): Promise<{ uid: string; email?: string; role: 'user' | 'admin' } | null> {
  const { adminDb, adminAuth } = getAdminServices();

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7).trim();
    // A Firebase ID token is strictly a 3-part dot-separated JWT (header.payload.signature)
    const isJwt = idToken.split('.').length === 3;

    if (isJwt) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const email = decoded.email || '';

        // Check role in Firestore users collection
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
        // Token could be expired or invalid, log debug info without crashing
        console.warn('Firebase ID token verification failed:', err.message);
      }
    } else if (idToken && !idToken.includes(' ') && idToken.length >= 10 && idToken.length <= 128) {
      // Non-JWT passed in Authorization header (e.g. raw userId from preview client or fallback)
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

  // Check custom header or query if in development/authorized
  const fallbackUid = req.headers['x-user-id'] as string || req.query.userId as string || req.body?.userId;
  if (fallbackUid) {
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

  return null;
}
