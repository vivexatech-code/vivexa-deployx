import { NextRequest, NextResponse } from 'next/server';
import { RepoInspector } from '@/lib/services/repoInspector';

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
  const branch = searchParams.get('branch') || 'main';
  const rootDir = searchParams.get('rootDirectory') || '';
  const userId = getUserId(req);

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required parameters' }, { status: 400 });
  }

  const result = await RepoInspector.inspectRepository({
    owner,
    repo,
    branch,
    rootDirectory: rootDir,
    userId: userId || undefined,
  });

  return NextResponse.json(result);
}
