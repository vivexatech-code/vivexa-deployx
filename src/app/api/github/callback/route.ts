import { NextRequest } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices, isAdminConfigured } from '@/lib/firebase/admin';
import { verifyOAuthState } from '@/lib/github/oauthState';
import { renderOAuthPopup } from '@/lib/github/oauthPopup';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const verified = state ? verifyOAuthState(state) : null;
  const origin = verified?.origin || req.nextUrl.origin;
  const userId = verified?.userId || null;

  const fail = (message: string) =>
    renderOAuthPopup({
      success: false,
      message,
      origin,
      payload: { type: 'GITHUB_OAUTH_ERROR', error: message },
    });

  if (!verified || !userId) {
    return fail('Authorization state is missing or expired. Please try connecting again.');
  }

  if (error || !code) {
    return fail(errorDescription || error || 'Authorization was cancelled or failed.');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return fail('GitHub OAuth credentials are not configured on the server.');
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return fail(tokenData.error_description || tokenData.error || 'Failed to exchange token with GitHub.');
    }

    const accessToken = tokenData.access_token;
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Vivexa-DeployX',
      },
    });

    const githubUser = await userRes.json();
    const username = githubUser.login || 'github_user';
    const avatarUrl = githubUser.avatar_url || '';

    await tokenStore.saveToken(userId, {
      token: accessToken,
      username,
      avatarUrl,
      connectedAt: new Date().toISOString(),
    });

    if (isAdminConfigured()) {
      try {
        const { adminDb } = getAdminServices();
        await adminDb.collection('users').doc(userId).set(
          {
            githubConnected: true,
            githubUsername: username,
            githubAvatarUrl: avatarUrl,
            githubConnectedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('Could not update Firestore user document with GitHub info:', dbErr);
      }
    }

    return renderOAuthPopup({
      success: true,
      message: `Successfully connected GitHub as @${username}!`,
      origin,
      payload: {
        type: 'GITHUB_OAUTH_SUCCESS',
        userId,
        username,
        avatarUrl,
        githubUserId: String(githubUser.id || ''),
      },
    });
  } catch (err: any) {
    console.error('Error during GitHub OAuth token exchange:', err);
    return fail(err.message || 'An unexpected error occurred during connection.');
  }
}
