import { NextRequest, NextResponse } from 'next/server';
import { purgeLegacySubdomains } from '@/lib/migration/subdomainCleanup';
import { authenticateApiRequest } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const result = await purgeLegacySubdomains();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
