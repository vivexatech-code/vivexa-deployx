import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices } from '@/lib/firebase/admin';

function getUserId(req: NextRequest): string | null {
  const headerUid = req.headers.get('x-user-id');
  if (headerUid) return headerUid.trim();

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && !token.includes('.')) return token;
    if (token && token.split('.').length === 3) {
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (payload.user_id || payload.sub) return payload.user_id || payload.sub;
      } catch {}
    }
  }

  const { searchParams } = new URL(req.url);
  return searchParams.get('userId');
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ connected: false, message: 'User ID is required' }, { status: 400 });
  }

  const stored = tokenStore.getToken(userId);
  if (stored) {
    return NextResponse.json({
      connected: true,
      username: stored.username,
      avatarUrl: stored.avatarUrl,
      connectedAt: stored.connectedAt,
    });
  }

  try {
    const { adminDb } = getAdminServices();
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data?.githubConnected) {
        return NextResponse.json({
          connected: true,
          username: data.githubUsername || 'github_user',
          avatarUrl: data.githubAvatarUrl,
          connectedAt: data.githubConnectedAt,
        });
      }
    }
  } catch {}

  return NextResponse.json({ connected: false });
}
