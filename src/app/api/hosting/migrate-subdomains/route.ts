import { NextResponse } from 'next/server';
import { purgeLegacySubdomains } from '@/lib/migration/subdomainCleanup';

export async function POST() {
  try {
    const result = await purgeLegacySubdomains();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
