import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  let origin = process.env.APP_URL || req.nextUrl.origin;
  let userId: string | null = null;

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded.origin) origin = decoded.origin;
      if (decoded.userId) userId = decoded.userId;
    } catch {}
  }

  const renderPopupResult = (success: boolean, msg: string, data?: any) => {
    const payload = JSON.stringify(
      success
        ? {
            type: 'GITHUB_OAUTH_SUCCESS',
            userId: userId || '',
            username: data?.username || 'github_user',
            avatarUrl: data?.avatarUrl || '',
            githubUserId: data?.githubUserId || '',
          }
        : {
            type: 'GITHUB_OAUTH_ERROR',
            error: msg,
          }
    );

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>GitHub Authorization</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 0.75rem; text-align: center; max-width: 400px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: ${success ? '#10b981' : '#ef4444'}; }
    p { color: #9ca3af; font-size: 0.875rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${success ? 'GitHub Connected!' : 'Connection Failed'}</h2>
    <p>${msg}</p>
    <p>This window will close automatically...</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
      }
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      window.close();
      if (!window.closed) {
        window.location.href = '${origin}/dashboard/projects/new?github=${success ? 'connected' : 'error'}';
      }
    }, 1200);
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: success ? 200 : 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };

  if (error || !code) {
    return renderPopupResult(false, errorDescription || error || 'Authorization was cancelled or failed.');
  }

  if (!userId) {
    return renderPopupResult(false, 'Missing user identification. Please try connecting again.');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return renderPopupResult(false, 'GitHub OAuth credentials are not configured on the server.');
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
      return renderPopupResult(false, tokenData.error_description || tokenData.error || 'Failed to exchange token with GitHub.');
    }

    const accessToken = tokenData.access_token;

    // Fetch user details from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Vivexa-Hosting-Platform',
      },
    });

    const githubUser = await userRes.json();
    const username = githubUser.login || 'github_user';
    const avatarUrl = githubUser.avatar_url;

    // Persist token in serverTokenStore
    tokenStore.saveToken(userId, {
      token: accessToken,
      username,
      avatarUrl,
      connectedAt: new Date().toISOString(),
    });

    // Update Firestore user document if available
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

    return renderPopupResult(true, `Successfully connected GitHub as @${username}!`, {
      username,
      avatarUrl,
    });
  } catch (err: any) {
    console.error('Error during GitHub OAuth token exchange:', err);
    return renderPopupResult(false, err.message || 'An unexpected error occurred during connection.');
  }
}
