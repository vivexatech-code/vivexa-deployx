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
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';

  const stored = tokenStore.getToken(userId);

  if (stored && stored.token && stored.token !== 'demo_simulated_token') {
    try {
      const ghRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${stored.token}`,
          'User-Agent': 'Vivexa-Hosting-Platform',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (ghRes.ok) {
        const repos = await ghRes.json();
        const formatted = repos.map((r: any) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          defaultBranch: r.default_branch || 'main',
          isPrivate: r.private,
          updatedAt: r.updated_at,
          htmlUrl: r.html_url,
          language: r.language,
          owner: {
            login: r.owner?.login,
            avatarUrl: r.owner?.avatar_url,
          },
        }));

        const filtered = search
          ? formatted.filter(
              (r: any) =>
                r.name.toLowerCase().includes(search.toLowerCase()) ||
                r.fullName.toLowerCase().includes(search.toLowerCase())
            )
          : formatted;

        return NextResponse.json({ repos: filtered });
      }
    } catch (err) {
      console.warn('GitHub API request failed, falling back to cached or demo repos:', err);
    }
  }

  // Simulated fallback for demo / test environment
  const demoRepos = [
    {
      id: 101,
      name: 'portfolio-website',
      fullName: `${stored?.username || 'user'}/portfolio-website`,
      description: 'Personal portfolio built with React and Tailwind CSS',
      defaultBranch: 'main',
      isPrivate: false,
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      htmlUrl: `https://github.com/${stored?.username || 'user'}/portfolio-website`,
      language: 'TypeScript',
      owner: {
        login: stored?.username || 'user',
        avatarUrl: stored?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
    },
    {
      id: 102,
      name: 'ecommerce-storefront',
      fullName: `${stored?.username || 'user'}/ecommerce-storefront`,
      description: 'Modern e-commerce landing page with Next.js App Router',
      defaultBranch: 'main',
      isPrivate: false,
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      htmlUrl: `https://github.com/${stored?.username || 'user'}/ecommerce-storefront`,
      language: 'TypeScript',
      owner: {
        login: stored?.username || 'user',
        avatarUrl: stored?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
    },
    {
      id: 103,
      name: 'saas-landing-page',
      fullName: `${stored?.username || 'user'}/saas-landing-page`,
      description: 'High-converting SaaS landing page with dark mode and pricing cards',
      defaultBranch: 'main',
      isPrivate: false,
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      htmlUrl: `https://github.com/${stored?.username || 'user'}/saas-landing-page`,
      language: 'JavaScript',
      owner: {
        login: stored?.username || 'user',
        avatarUrl: stored?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
    },
  ];

  const filtered = search
    ? demoRepos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : demoRepos;

  return NextResponse.json({ repos: filtered });
}
