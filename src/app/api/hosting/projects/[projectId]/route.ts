import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';

export async function DELETE(
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

    // Delete custom domains from Vercel
    const domainsSnap = await adminDb.collection('domains').where('projectId', '==', projectId).get();
    for (const doc of domainsSnap.docs) {
      const d = doc.data();
      if (project.vercelProjectId && VercelService.isConfigured() && d.domain) {
        try {
          await VercelService.removeDomainFromProject(project.vercelProjectId, d.domain);
        } catch {}
      }
      await doc.ref.delete().catch(() => {});
    }

    // Delete project from Vercel
    if (VercelService.isConfigured()) {
      const vId = project.vercelProjectId || project.vercelProjectName;
      if (vId) {
        try {
          await VercelService.deleteProject(vId);
        } catch (err: any) {
          console.warn('Warning: Could not delete project from Vercel:', err.message);
        }
      }
    }

    // Delete project from Firestore
    await adminDb.collection('projects').doc(projectId).delete();

    return NextResponse.json({ success: true, message: 'Project and associated custom domains removed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
