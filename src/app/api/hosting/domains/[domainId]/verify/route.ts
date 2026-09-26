import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { domainId } = await params;
    const { adminDb } = getAdminServices();

    const domSnap = await adminDb.collection('domains').doc(domainId).get();
    if (!domSnap.exists) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    const domainDoc = domSnap.data();
    if (domainDoc.userId !== user.uid && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projSnap = await adminDb.collection('projects').doc(domainDoc.projectId).get();
    const vercelProjectId = domainDoc.vercelProjectId || (projSnap.exists ? projSnap.data()?.vercelProjectId : null);

    let verifyResult: any = { verified: false, message: 'Vercel not configured' };
    if (vercelProjectId && VercelService.isConfigured()) {
      verifyResult = await VercelService.verifyDomain(vercelProjectId, domainDoc.domain);
    }

    const now = new Date().toISOString();

    if (verifyResult.verified) {
      await adminDb.collection('domains').doc(domainId).update({
        verified: true,
        status: 'active',
        dnsRecords: verifyResult.dnsRecords || domainDoc.dnsRecords || [],
        verification: [],
        verifiedAt: now,
        updatedAt: now,
      });

      if (domainDoc.isPrimary && projSnap.exists) {
        await adminDb.collection('projects').doc(domainDoc.projectId).update({
          productionUrl: `https://${domainDoc.domain}`,
          updatedAt: now,
        });
      }
    } else {
      await adminDb.collection('domains').doc(domainId).update({
        verified: false,
        status: 'pending',
        dnsRecords: verifyResult.dnsRecords || domainDoc.dnsRecords || [],
        verification: verifyResult.verification || domainDoc.verification || [],
        updatedAt: now,
      });
    }

    return NextResponse.json({
      verified: verifyResult.verified,
      message: verifyResult.message,
      domain: {
        ...domainDoc,
        verified: verifyResult.verified,
        status: verifyResult.verified ? 'active' : 'pending',
        dnsRecords: verifyResult.dnsRecords || domainDoc.dnsRecords,
        verification: verifyResult.verification || domainDoc.verification,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
