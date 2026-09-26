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
        const parts = parsedUrl.pathname.replace(/^\/|\.git$/g, '').split('/');
        if (parts.length >= 2) {
          finalRepoOwner = parts[0];
          finalRepoName = parts[1];
        }
      } catch {}
    }

    const now = new Date();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanRootDir = (rootDirectory || '').replace(/^\/+|\/+$/g, '').trim();

    let vercelProjectId = '';
    let vercelProjectName = '';
    let initialDeployment: any = null;

    if (VercelService.isConfigured()) {
      try {
        const safeSlug =
          name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'project';
        const uniqueVercelName = `${safeSlug}-${user.uid.slice(0, 6)}`;

        const vercelProject = await VercelService.createProject({
          name: uniqueVercelName,
          framework: framework || null,
          buildCommand: buildCommand || undefined,
          outputDirectory: outputDirectory || undefined,
          installCommand: installCommand || undefined,
          rootDirectory: cleanRootDir || undefined,
          environmentVariables: envVars || undefined,
        });

        vercelProjectId = vercelProject.id;
        vercelProjectName = vercelProject.name;

        try {
          initialDeployment = await VercelService.createDeployment({
            projectId: vercelProjectId,
            projectName: name,
            branch: gitBranch || 'main',
            repoName: finalRepoName,
            repoOwner: finalRepoOwner,
            rootDirectory: cleanRootDir || undefined,
            framework: framework || null,
            buildCommand: buildCommand || null,
            outputDirectory: outputDirectory || null,
            installCommand: installCommand || null,
            userId: user.uid,
          });
        } catch (deployErr: any) {
          console.warn('Initial deployment warning:', deployErr.message);
        }
      } catch (vercelErr: any) {
        console.error('Vercel provisioning error:', vercelErr);
      }
    }

    const productionUrl = initialDeployment?.url || '';

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
      framework: framework || 'vite',
      buildCommand: buildCommand || '',
      outputDirectory: outputDirectory || 'dist',
      installCommand: installCommand || '',
      envVars: envVars || {},
      status: initialDeployment?.readyState === 'READY' ? 'READY' : 'BUILDING',
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
      status: initialDeployment?.readyState === 'READY' ? 'READY' : 'BUILDING',
      branch: gitBranch || 'main',
      commitMessage: 'Initial project setup and deployment',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('deployments').doc(deploymentId).set(deploymentRecord);

    await adminDb.collection('notifications').doc(`notif_${Date.now()}`).set({
      id: `notif_${Date.now()}`,
      userId: user.uid,
      title: 'Project Deployed to Vercel! 🚀',
      message: `${name} has been built and deployed. Connect your custom domain to take it live.`,
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
