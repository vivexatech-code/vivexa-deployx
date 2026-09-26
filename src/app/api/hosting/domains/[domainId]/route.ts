import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';

export async function DELETE(
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

    if (vercelProjectId && VercelService.isConfigured()) {
      try {
        await VercelService.removeDomainFromProject(vercelProjectId, domainDoc.domain);
      } catch (removeErr: any) {
        console.warn('Vercel domain remove notice:', removeErr.message);
      }
    }

    await adminDb.collection('domains').doc(domainId).delete();

    if (projSnap.exists) {
      const proj = projSnap.data();
      const updatedDomains = (proj.customDomains || []).filter((d: string) => d !== domainDoc.domain);
      const updates: any = {
        customDomains: updatedDomains,
        updatedAt: new Date().toISOString(),
      };
      if (domainDoc.isPrimary) {
        updates.productionUrl = updatedDomains.length > 0 ? `https://${updatedDomains[0]}` : '';
      }
      await adminDb.collection('projects').doc(domainDoc.projectId).update(updates);
    }

    return NextResponse.json({ success: true, message: 'Custom domain removed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
