import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/firebase/admin';
import { resolveOAuthOrigin, signOAuthState } from '@/lib/github/oauthState';

export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required to connect GitHub' }, { status: 401 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const { searchParams } = new URL(req.url);
  const origin = resolveOAuthOrigin(req, searchParams.get('origin'));

  let state = '';
  try {
    state = signOAuthState(user.uid, origin);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not sign OAuth state.' }, { status: 500 });
  }

  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || `${origin}/api/github/callback`;

  if (!clientId || !clientSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'GitHub OAuth is not configured on the server.' },
        { status: 500 }
      );
    }

    const demoUrl = `/api/github/demo-callback?state=${encodeURIComponent(state)}`;
    return NextResponse.json({
      configured: false,
      url: demoUrl,
      message: 'GitHub OAuth credentials are not set. Preview mode is available outside production.',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'repo,read:user,user:email',
    state,
    allow_signup: 'true',
  });

  return NextResponse.json({
    configured: true,
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    callbackUrl,
  });
}
