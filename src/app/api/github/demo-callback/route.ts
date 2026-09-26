import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices, isAdminConfigured } from '@/lib/firebase/admin';
import { verifyOAuthState } from '@/lib/github/oauthState';
import { renderOAuthPopup } from '@/lib/github/oauthPopup';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'GitHub preview mode is disabled in production.' }, { status: 404 });
  }

  const state = new URL(req.url).searchParams.get('state') || '';
  const verified = state ? verifyOAuthState(state) : null;
  if (!verified) {
    return renderOAuthPopup({
      success: false,
      message: 'Authorization state is missing or expired. Please try connecting again.',
      origin: req.nextUrl.origin,
      payload: {
        type: 'GITHUB_OAUTH_ERROR',
        error: 'Authorization state is missing or expired.',
      },
    });
  }

  const simulatedUsername = 'vivexa_developer';
  const simulatedAvatarUrl =
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

  await tokenStore.saveToken(verified.userId, {
    token: 'demo_simulated_token',
    username: simulatedUsername,
    avatarUrl: simulatedAvatarUrl,
    connectedAt: new Date().toISOString(),
  });

  if (isAdminConfigured()) {
    try {
      const { adminDb } = getAdminServices();
      await adminDb.collection('users').doc(verified.userId).set(
        {
          githubConnected: true,
          githubUsername: simulatedUsername,
          githubAvatarUrl: simulatedAvatarUrl,
          githubConnectedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not store preview GitHub connection:', err);
    }
  }

  return renderOAuthPopup({
    success: true,
    message: `Connected simulated GitHub account @${simulatedUsername}`,
    origin: verified.origin,
    payload: {
      type: 'GITHUB_OAUTH_SUCCESS',
      userId: verified.userId,
      username: simulatedUsername,
      avatarUrl: simulatedAvatarUrl,
      githubUserId: 'demo_user_123',
    },
  });
}
