import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices } from '@/lib/firebase/admin';

function getUserId(req: NextRequest, body?: any): string | null {
  if (body?.userId) return body.userId;
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

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const userId = getUserId(req, body);
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  tokenStore.deleteToken(userId);

  try {
    const { adminDb } = getAdminServices();
    await adminDb.collection('users').doc(userId).set(
      {
        githubConnected: false,
        githubUsername: null,
        githubAvatarUrl: null,
        githubConnectedAt: null,
      },
      { merge: true }
    );
  } catch {}

  return NextResponse.json({ success: true, message: 'GitHub account disconnected successfully' });
}
