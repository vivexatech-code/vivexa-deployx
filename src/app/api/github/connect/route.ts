import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({ error: 'User ID is required to connect GitHub' }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  const { searchParams } = new URL(req.url);
  const reqOrigin = searchParams.get('origin');
  const fallbackOrigin = process.env.APP_URL || req.nextUrl.origin;
  const origin = reqOrigin || fallbackOrigin;
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || `${origin}/api/github/callback`;

  const statePayload = {
    userId,
    origin,
    nonce: Math.random().toString(36).substring(2, 15),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  if (!clientId || !clientSecret) {
    const demoUrl = `/api/github/demo-callback?userId=${encodeURIComponent(userId)}&origin=${encodeURIComponent(origin)}`;
    return NextResponse.json({
      configured: false,
      url: demoUrl,
      message: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set in environment variables. You can test with preview simulation.',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'repo,read:user,user:email',
    state,
    allow_signup: 'true',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return NextResponse.json({
    configured: true,
    url: authUrl,
    callbackUrl,
  });
}
