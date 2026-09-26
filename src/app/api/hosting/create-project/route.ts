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

    const { adminDb } = getAdminServices();

    // 1. Check user entitlement / project limits
    const entitlement = await EntitlementService.canCreateProject(adminDb, user.uid);
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          error: entitlement.reason,
          currentCount: entitlement.currentCount,
          maxLimit: entitlement.maxLimit,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      repositoryUrl,
      repositoryName,
      repositoryOwner,
      repositoryId,
      rootDirectory,
      framework,
      buildCommand,
      outputDirectory,
      installCommand,
      envVars,
      gitBranch,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
    }

    let finalRepoOwner = repositoryOwner || '';
    let finalRepoName = repositoryName || '';
    if ((!finalRepoOwner || !finalRepoName) && repositoryUrl) {
      try {
        const parsedUrl = new URL(repositoryUrl);
        const parts = parsedUrl.pathname.replace(/\.git$/, '').replace(/^\//, '').split('/');
        if (parts.length >= 2) {
          finalRepoOwner = parts[0];
          finalRepoName = parts[1];
        }
      } catch {}
    }

    const now = new Date();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanRootDir = (rootDirectory || '').replace(/^\/+|\/+$/g, '').trim();
    const isStatic = framework === 'static';
    const resolvedFramework = isStatic ? 'static' : (framework || 'vite');

    if (!VercelService.isConfigured()) {
      return NextResponse.json(
        { error: 'VERCEL_TOKEN is not configured on the server.' },
        { status: 503 }
      );
    }

    let vercelProjectId = '';
    let vercelProjectName = '';
    let initialDeployment: any = null;

    const safeSlug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'project';
    const uniqueVercelName = `${safeSlug}-${user.uid.slice(0, 6)}`;

    try {
      const vercelProject = await VercelService.createProject({
        name: uniqueVercelName,
        framework: isStatic ? null : resolvedFramework,
        buildCommand: isStatic ? null : buildCommand || undefined,
        outputDirectory: isStatic ? null : outputDirectory || undefined,
        installCommand: isStatic ? null : installCommand || undefined,
        rootDirectory: cleanRootDir || undefined,
        environmentVariables: envVars || undefined,
      });

      vercelProjectId = vercelProject.id;
      vercelProjectName = vercelProject.name;

      initialDeployment = await VercelService.createDeployment({
        projectId: vercelProjectId,
        projectName: name,
        branch: gitBranch || 'main',
        repoName: finalRepoName,
        repoOwner: finalRepoOwner,
        rootDirectory: cleanRootDir || undefined,
        framework: isStatic ? null : resolvedFramework,
        buildCommand: isStatic ? null : buildCommand || null,
        outputDirectory: isStatic ? null : outputDirectory || null,
        installCommand: isStatic ? null : installCommand || null,
        userId: user.uid,
      });
    } catch (vercelErr: any) {
      console.error('Vercel provisioning error:', vercelErr);
      return NextResponse.json(
        { error: vercelErr.message || 'Could not deploy the project to Vercel.' },
        { status: 502 }
      );
    }

    const productionUrl = initialDeployment?.url || '';
    const deploymentReady = initialDeployment?.readyState === 'READY';

    const projectRecord = {
      id: projectId,
      userId: user.uid,
      name: name.trim(),
      customDomains: [],
      repositoryId: repositoryId || '',
      repositoryName: finalRepoName,
      repositoryOwner: finalRepoOwner,
      repositoryUrl: repositoryUrl || '',
      rootDirectory: cleanRootDir,
      framework: resolvedFramework,
      buildCommand: isStatic ? '' : buildCommand || '',
      outputDirectory: isStatic ? '' : outputDirectory || 'dist',
      installCommand: isStatic ? '' : installCommand || '',
      envVars: envVars || {},
      status: deploymentReady ? 'READY' : 'BUILDING',
      productionUrl,
      vercelProjectId: vercelProjectId || '',
      vercelProjectName: vercelProjectName || '',
      gitBranch: gitBranch || 'main',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('projects').doc(projectId).set(projectRecord);

    const deploymentId = `dep_${Date.now()}`;
    const deploymentRecord = {
      id: deploymentId,
      projectId,
      userId: user.uid,
      vercelDeploymentId: initialDeployment?.id || '',
      url: productionUrl,
      status: deploymentReady ? 'READY' : 'BUILDING',
      branch: gitBranch || 'main',
      commitMessage: 'Initial project setup and deployment',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('deployments').doc(deploymentId).set(deploymentRecord);

    await adminDb.collection('notifications').doc(`notif_${Date.now()}`).set({
      id: `notif_${Date.now()}`,
      userId: user.uid,
      title: deploymentReady ? 'Project deployed' : 'Deployment started',
      message: deploymentReady
        ? `${name} is live on the Vercel edge. Connect a custom domain when you are ready.`
        : `${name} is building on Vercel. Connect a custom domain after the deployment is ready.`,
      type: 'success',
      link: `/dashboard/projects/${projectId}`,
      read: false,
      createdAt: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      project: projectRecord,
      deployment: deploymentRecord,
    });
  } catch (err: any) {
    console.error('Error in create-project route:', err);
    return NextResponse.json({ error: err.message || 'Failed to create and deploy project' }, { status: 500 });
  }
}
