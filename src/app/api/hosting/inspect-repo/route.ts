import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/firebase/admin';
import { RepoInspector } from '@/lib/services/repoInspector';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { owner, repo, branch = 'main', rootDirectory = '' } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
    }

    const result = await RepoInspector.inspectRepository({
      owner,
      repo,
      branch,
      rootDirectory,
      userId: user.uid,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error inspecting repository:', err);
    return NextResponse.json({ error: err.message || 'Failed to inspect repository' }, { status: 500 });
  }
}
