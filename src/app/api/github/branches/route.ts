import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';

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
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const userId = getUserId(req);

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required parameters' }, { status: 400 });
  }

  const stored = userId ? tokenStore.getToken(userId) : null;

  if (stored && stored.token && stored.token !== 'demo_simulated_token') {
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          Authorization: `Bearer ${stored.token}`,
          'User-Agent': 'Vivexa-Hosting-Platform',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (ghRes.ok) {
        const branches = await ghRes.json();
        return NextResponse.json({
          branches: branches.map((b: any) => ({
            name: b.name,
            commitSha: b.commit?.sha,
            isProtected: b.protected,
          })),
        });
      }
    } catch (err) {
      console.warn('Could not fetch branches from GitHub API:', err);
    }
  }

  return NextResponse.json({
    branches: [
      { name: 'main', commitSha: '7f9a1c2', isProtected: false },
      { name: 'master', commitSha: '3e4d5a1', isProtected: false },
      { name: 'dev', commitSha: '9b8c7d6', isProtected: false },
    ],
  });
}
