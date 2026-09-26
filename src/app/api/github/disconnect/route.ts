import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { authenticateApiRequest, getAdminServices, isAdminConfigured } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  await tokenStore.deleteToken(user.uid);

  if (isAdminConfigured()) {
    try {
      const { adminDb } = getAdminServices();
      await adminDb.collection('users').doc(user.uid).set(
        {
          githubConnected: false,
          githubUsername: null,
          githubAvatarUrl: null,
          githubConnectedAt: null,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not update Firestore GitHub disconnect state:', err);
    }
  }

  return NextResponse.json({ success: true, message: 'GitHub account disconnected successfully' });
}
