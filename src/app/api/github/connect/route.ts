import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAdminConfigured } from '@/lib/firebase/admin';
import { resolveOAuthOrigin, signOAuthState } from '@/lib/github/oauthState';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            'Server auth is not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in Vercel environment variables.',
        },
        { status: 503 }
      );
    }

    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to connect GitHub. Please sign in again.' },
        { status: 401 }
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const { searchParams } = new URL(req.url);
    const origin = resolveOAuthOrigin(req, searchParams.get('origin'));

    if (!clientId || !clientSecret) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            error:
              'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel environment variables.',
          },
          { status: 503 }
        );
      }

      let demoState = '';
      try {
        demoState = signOAuthState(user.uid, origin);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Could not sign OAuth state.' }, { status: 500 });
      }

      return NextResponse.json({
        configured: false,
        url: `/api/github/demo-callback?state=${encodeURIComponent(demoState)}`,
        message: 'GitHub OAuth credentials are not set. Preview mode is available outside production.',
      });
    }

    let state = '';
    try {
      state = signOAuthState(user.uid, origin);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Could not sign OAuth state.' }, { status: 500 });
    }

    const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || `${origin}/api/github/callback`;

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
  } catch (err: any) {
    console.error('GitHub connect error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
}
