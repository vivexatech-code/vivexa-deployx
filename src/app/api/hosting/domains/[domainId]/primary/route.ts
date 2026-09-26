import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';

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

    const now = new Date().toISOString();

    const siblingSnap = await adminDb.collection('domains').where('projectId', '==', domainDoc.projectId).get();
    for (const doc of siblingSnap.docs) {
      await doc.ref.update({ isPrimary: doc.id === domainId, updatedAt: now });
    }

    await adminDb.collection('projects').doc(domainDoc.projectId).update({
      productionUrl: `https://${domainDoc.domain}`,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, message: `${domainDoc.domain} is now the primary domain.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
