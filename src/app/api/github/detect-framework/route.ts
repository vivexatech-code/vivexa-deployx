import { NextRequest, NextResponse } from 'next/server';
import { RepoInspector } from '@/lib/services/repoInspector';
import { authenticateApiRequest } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch') || 'main';
  const rootDir = searchParams.get('rootDirectory') || '';

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required parameters' }, { status: 400 });
  }

  const result = await RepoInspector.inspectRepository({
    owner,
    repo,
    branch,
    rootDirectory: rootDir,
    userId: user.uid,
  });

  return NextResponse.json(result);
}
