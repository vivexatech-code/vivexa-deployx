import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { getAdminServices } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const origin = searchParams.get('origin') || process.env.APP_URL || req.nextUrl.origin;

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const simulatedUsername = 'vivexa_developer';
  const simulatedAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

  tokenStore.saveToken(userId, {
    token: 'demo_simulated_token',
    username: simulatedUsername,
    avatarUrl: simulatedAvatarUrl,
    connectedAt: new Date().toISOString(),
  });

  try {
    const { adminDb } = getAdminServices();
    await adminDb.collection('users').doc(userId).set(
      {
        githubConnected: true,
        githubUsername: simulatedUsername,
        githubAvatarUrl: simulatedAvatarUrl,
        githubConnectedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}

  const payload = JSON.stringify({
    type: 'GITHUB_OAUTH_SUCCESS',
    userId,
    username: simulatedUsername,
    avatarUrl: simulatedAvatarUrl,
    githubUserId: 'demo_user_123',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>GitHub Authorization (Preview Mode)</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 0.75rem; text-align: center; max-width: 400px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #10b981; }
    p { color: #9ca3af; font-size: 0.875rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>GitHub Connected (Preview)</h2>
    <p>Connected simulated GitHub account @${simulatedUsername}</p>
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
        window.location.href = '${origin}/dashboard/projects/new?github=connected';
      }
    }, 1200);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
