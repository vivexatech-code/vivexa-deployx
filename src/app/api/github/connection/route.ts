import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { authenticateApiRequest, getAdminServices, isAdminConfigured } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ connected: false, message: 'Authentication required' }, { status: 401 });
  }

  const stored = await tokenStore.getToken(user.uid);
  if (stored) {
    return NextResponse.json({
      connected: true,
      username: stored.username,
      avatarUrl: stored.avatarUrl,
      connectedAt: stored.connectedAt,
    });
  }

  if (isAdminConfigured()) {
    try {
      const { adminDb } = getAdminServices();
      const userDoc = await adminDb.collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data()?.githubConnected && userDoc.data()?.githubUsername) {
        const data = userDoc.data();
        return NextResponse.json({
          connected: false,
          username: data.githubUsername,
          avatarUrl: data.githubAvatarUrl,
          connectedAt: data.githubConnectedAt,
          message: 'GitHub profile is saved, but the access token is missing. Reconnect GitHub.',
        });
      }
    } catch (err) {
      console.warn('Could not read GitHub connection profile:', err);
    }
  }

  return NextResponse.json({ connected: false });
}
