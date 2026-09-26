import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;
    const { adminDb } = getAdminServices();

    const projSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const domainsSnap = await adminDb.collection('domains').where('projectId', '==', projectId).get();
    const domainsList: any[] = [];
    domainsSnap.forEach((doc: any) => {
      domainsList.push(doc.data());
    });

    return NextResponse.json({
      project,
      domains: domainsList,
      vercelConfigured: VercelService.isConfigured(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
