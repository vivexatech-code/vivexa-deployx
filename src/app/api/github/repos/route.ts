import { NextRequest, NextResponse } from 'next/server';
import { tokenStore } from '@/lib/github/tokenStore';
import { authenticateApiRequest } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.uid;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';

  const stored = await tokenStore.getToken(userId);

  if (stored && stored.token && stored.token !== 'demo_simulated_token') {
    try {
      const ghRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${stored.token}`,
          'User-Agent': 'Vivexa-DeployX',
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

  if (!stored || stored.token !== 'demo_simulated_token' || process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: stored
          ? 'Could not load repositories from GitHub. Reconnect your account and try again.'
          : 'GitHub is not connected. Connect GitHub and try again.',
      },
      { status: stored ? 502 : 409 }
    );
  }

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
