import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';
import { EntitlementService } from '@/lib/entitlements/entitlementService';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId;
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const { adminDb } = getAdminServices();
    const projSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized to deploy this project' }, { status: 403 });
    }

    const entitlement = await EntitlementService.canDeploy(adminDb, user.uid);
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          error: entitlement.reason || 'Please select and activate a plan before deploying.',
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    let deploymentResult: any = null;
    if (project.vercelProjectId && VercelService.isConfigured()) {
      deploymentResult = await VercelService.createDeployment({
        projectId: project.vercelProjectId,
        projectName: project.name,
        branch: body?.branch || project.gitBranch || 'main',
        repoName: project.repositoryName || project.name,
        repoOwner: project.repositoryOwner || '',
        rootDirectory: project.rootDirectory || undefined,
        framework: project.framework || null,
        buildCommand: project.buildCommand || null,
        outputDirectory: project.outputDirectory || null,
        installCommand: project.installCommand || null,
        userId: user.uid,
      });
    }

    const depId = `dep_${Date.now()}`;
    const now = new Date();
    const deploymentRecord = {
      id: depId,
      projectId,
      userId: user.uid,
      vercelDeploymentId: deploymentResult?.id || '',
      url: deploymentResult?.url || project.productionUrl,
      status: deploymentResult?.readyState === 'READY' ? 'READY' : 'BUILDING',
      branch: body?.branch || project.gitBranch || 'main',
      commitMessage: body?.commitMessage || 'Manual redeployment from Vivexa dashboard',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('deployments').doc(depId).set(deploymentRecord);

    await adminDb.collection('projects').doc(projectId).update({
      status: 'READY',
      productionUrl: deploymentResult?.url || project.productionUrl,
      updatedAt: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      deployment: deploymentRecord,
    });
  } catch (err: any) {
    console.error('Error redeploying project:', err);
    return NextResponse.json({ error: err.message || 'Deployment failed' }, { status: 500 });
  }
}
