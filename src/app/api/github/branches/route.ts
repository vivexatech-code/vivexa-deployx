import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { authenticateApiRequest } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.uid;

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required parameters' }, { status: 400 });
  }

  const stored = await tokenStore.getToken(userId);

  if (stored && stored.token && stored.token !== 'demo_simulated_token') {
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          Authorization: `Bearer ${stored.token}`,
          'User-Agent': 'Vivexa-DeployX',
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

  if (stored?.token === 'demo_simulated_token' && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      branches: [
        { name: 'main', commitSha: '7f9a1c2', isProtected: false },
        { name: 'master', commitSha: '3e4d5a1', isProtected: false },
        { name: 'dev', commitSha: '9b8c7d6', isProtected: false },
      ],
    });
  }

  return NextResponse.json(
    { error: 'Could not load branches from GitHub. Reconnect your account and try again.' },
    { status: 502 }
  );
}
