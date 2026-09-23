import { Router } from 'express';
import { getAdminServices, authenticateRequest } from '../firebaseAdmin';
import { VercelService } from '../vercelService';
import { EntitlementService } from '../entitlementService';
import { RepoInspector } from '../services/repoInspector';

export const hostingRouter = Router();

/**
 * Create a new hosting project end-to-end:
 * 1. Checks user plan limits
 * 2. Creates project in Vercel with environment & build configuration
 * 3. Creates initial deployment on Vercel edge network
 * 4. Persists project and deployment in Firestore
 * (Custom domain is connected by user afterwards)
 */
hostingRouter.post('/create-project', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { adminDb } = getAdminServices();

    // 1. Check user entitlement / project limits
    const entitlement = await EntitlementService.canCreateProject(adminDb, user.uid);
    if (!entitlement.allowed) {
      res.status(403).json({
        error: entitlement.reason,
        currentCount: entitlement.currentCount,
        maxLimit: entitlement.maxLimit,
      });
      return;
    }

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
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }

    // Determine repository owner and name from params or repositoryUrl
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
      } catch {
        // ignore parse error
      }
    }

    const now = new Date();
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanRootDir = (rootDirectory || '').replace(/^\/+|\/+$/g, '').trim();

    // 2. Provision on Vercel if configured
    let vercelProjectId = '';
    let vercelProjectName = '';
    let initialDeployment: any = null;

    if (VercelService.isConfigured()) {
      try {
        const safeSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'project';
        const uniqueVercelName = `${safeSlug}-${user.uid.slice(0, 6)}`;

        // Create Vercel Project
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

        // Deploy repository source code to Vercel edge
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

    // 3. Persist Project in Firestore
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

    // 4. Create initial Deployment Record in Firestore
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

    // 5. In-app Notification
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

    res.json({
      success: true,
      project: projectRecord,
      deployment: deploymentRecord,
    });
  } catch (err: any) {
    console.error('Error in create-project route:', err);
    res.status(500).json({ error: err.message || 'Failed to create and deploy project' });
  }
});

/**
 * Trigger redeployment on Vercel
 */
hostingRouter.post('/projects/:id/deploy', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const projSnap = await adminDb.collection('projects').doc(id).get();
    if (!projSnap.exists) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized to deploy this project' });
      return;
    }

    // Enforce active subscription and deployment quotas server-side
    const entitlement = await EntitlementService.canDeploy(adminDb, user.uid);
    if (!entitlement.allowed) {
      res.status(403).json({
        error: entitlement.reason || 'Please select and activate a plan before deploying.',
        requiresUpgrade: true,
      });
      return;
    }

    let deploymentResult: any = null;
    if (project.vercelProjectId && VercelService.isConfigured()) {
      deploymentResult = await VercelService.createDeployment({
        projectId: project.vercelProjectId,
        projectName: project.name,
        branch: req.body?.branch || project.gitBranch || 'main',
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
      projectId: id,
      userId: user.uid,
      vercelDeploymentId: deploymentResult?.id || '',
      url: deploymentResult?.url || project.productionUrl,
      status: deploymentResult?.readyState === 'READY' ? 'READY' : 'BUILDING',
      branch: req.body?.branch || project.gitBranch || 'main',
      commitMessage: req.body?.commitMessage || 'Manual redeployment from Vivexa dashboard',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('deployments').doc(depId).set(deploymentRecord);

    await adminDb.collection('projects').doc(id).update({
      status: 'READY',
      productionUrl: deploymentResult?.url || project.productionUrl,
      updatedAt: now.toISOString(),
    });

    res.json({
      success: true,
      deployment: deploymentRecord,
    });
  } catch (err: any) {
    console.error('Error deploying project:', err);
    res.status(500).json({ error: err.message || 'Deployment failed' });
  }
});

/**
 * Inspect a repository for framework, package.json, build command, and monorepo root directory
 */
hostingRouter.post('/inspect-repo', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    const { owner, repo, branch = 'main', rootDirectory = '' } = req.body;

    if (!owner || !repo) {
      res.status(400).json({ error: 'owner and repo are required' });
      return;
    }

    const result = await RepoInspector.inspectRepository({
      owner,
      repo,
      branch,
      rootDirectory,
      userId: user?.uid,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error inspecting repository:', err);
    res.status(500).json({ error: err.message || 'Failed to inspect repository' });
  }
});

/**
 * Sync project deployment and domain status with Vercel
 */
hostingRouter.get('/projects/:id/sync', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const projSnap = await adminDb.collection('projects').doc(id).get();
    if (!projSnap.exists) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Retrieve all custom domains attached to this project
    const domainsSnap = await adminDb.collection('domains').where('projectId', '==', id).get();
    const domainsList: any[] = [];
    domainsSnap.forEach((doc) => {
      domainsList.push(doc.data());
    });

    res.json({
      project,
      domains: domainsList,
      vercelConfigured: VercelService.isConfigured(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete project from Vercel and Firestore
 */
hostingRouter.delete('/projects/:id', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const projSnap = await adminDb.collection('projects').doc(id).get();
    if (!projSnap.exists) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Delete custom domains from Vercel
    const domainsSnap = await adminDb.collection('domains').where('projectId', '==', id).get();
    for (const doc of domainsSnap.docs) {
      const d = doc.data();
      if (project.vercelProjectId && VercelService.isConfigured() && d.domain) {
        try {
          await VercelService.removeDomainFromProject(project.vercelProjectId, d.domain);
        } catch {}
      }
      await doc.ref.delete().catch(() => {});
    }

    // Delete from Vercel
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

    // Cleanup any legacy records if present
    if (project.subdomain) {
      await adminDb.collection('subdomains').doc(project.subdomain).delete().catch(() => {});
      await adminDb.collection('domains').doc(`dom_${project.subdomain}`).delete().catch(() => {});
    }

    // Delete project from Firestore
    await adminDb.collection('projects').doc(id).delete();

    res.json({ success: true, message: 'Project and associated custom domains removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add custom domain to a project
 */
hostingRouter.post('/projects/:id/custom-domain', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'Domain name is required' });
      return;
    }

    const { adminDb } = getAdminServices();

    // Entitlement check for custom domains
    const ent = await EntitlementService.canAddCustomDomain(adminDb, user.uid);
    if (!ent.allowed) {
      res.status(403).json({ error: ent.reason });
      return;
    }

    const projSnap = await adminDb.collection('projects').doc(id).get();
    if (!projSnap.exists) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

    // Prevent using vivexatech.in or any subdomains of it
    if (cleanDomain === 'vivexatech.in' || cleanDomain.endsWith('.vivexatech.in')) {
      res.status(400).json({
        error: 'Free *.vivexatech.in subdomains are no longer supported. Please enter your own custom domain (e.g. yourbrand.com or app.yourbrand.com).',
      });
      return;
    }

    // Basic domain validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
    if (!domainRegex.test(cleanDomain)) {
      res.status(400).json({ error: 'Invalid domain format. Example: example.com or app.example.com' });
      return;
    }

    // Check duplicate domain in Firestore
    const existingDomainSnap = await adminDb.collection('domains').where('domain', '==', cleanDomain).get();
    if (!existingDomainSnap.empty) {
      const existingDoc = existingDomainSnap.docs[0].data();
      if (existingDoc.status !== 'removed') {
        if (existingDoc.projectId === id) {
          res.json({ success: true, domain: existingDoc, message: 'Domain is already configured for this project.' });
          return;
        } else {
          res.status(409).json({ error: `Domain "${cleanDomain}" is already attached to another project.` });
          return;
        }
      }
    }

    let vercelResult: any = null;
    let vercelError: string | null = null;

    if (project.vercelProjectId && VercelService.isConfigured()) {
      try {
        vercelResult = await VercelService.addDomainToProject(project.vercelProjectId, cleanDomain);
      } catch (domErr: any) {
        console.warn(`Vercel addDomain error for ${cleanDomain}:`, domErr.message);
        vercelError = domErr.message;
      }
    }

    const isApex = cleanDomain.split('.').length === 2;
    const domainId = `dom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();

    const existingCustom = project.customDomains || [];
    const isFirstDomain = existingCustom.length === 0;

    const domainStatus = vercelError ? 'error' : (vercelResult?.verified ? 'active' : 'pending');

    const domainRecord = {
      id: domainId,
      domain: cleanDomain,
      domainName: cleanDomain,
      type: 'custom',
      projectId: id,
      projectName: project.name,
      userId: user.uid,
      vercelProjectId: project.vercelProjectId || '',
      status: domainStatus,
      verified: Boolean(vercelResult?.verified),
      isPrimary: isFirstDomain,
      dnsRecords: vercelResult?.dnsRecords || [
        {
          type: isApex ? 'A' : 'CNAME',
          host: isApex ? '@' : cleanDomain.split('.')[0],
          value: isApex ? '76.76.21.21' : 'cname.vercel-dns.com',
          status: 'pending',
          reason: isApex ? 'Apex A record' : 'Subdomain CNAME record',
        },
      ],
      dnsRecordType: (vercelResult?.dnsRecords?.[0]?.type) || (isApex ? 'A' : 'CNAME'),
      dnsHost: (vercelResult?.dnsRecords?.[0]?.host) || (isApex ? '@' : cleanDomain.split('.')[0]),
      dnsValue: (vercelResult?.dnsRecords?.[0]?.value) || (isApex ? '76.76.21.21' : 'cname.vercel-dns.com'),
      verification: vercelResult?.verification || [],
      error: vercelError || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('domains').doc(domainId).set(domainRecord);

    // Update project's customDomains array and primary productionUrl if verified
    if (!existingCustom.includes(cleanDomain)) {
      const updates: any = {
        customDomains: [...existingCustom, cleanDomain],
        updatedAt: now.toISOString(),
      };
      if (domainStatus === 'active' && isFirstDomain) {
        updates.productionUrl = `https://${cleanDomain}`;
      }
      await adminDb.collection('projects').doc(id).update(updates);
    }

    res.json({ success: !vercelError, domain: domainRecord, error: vercelError });
  } catch (err: any) {
    console.error('Error adding custom domain:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Verify custom domain DNS propagation
 */
hostingRouter.post('/domains/:id/verify', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const domSnap = await adminDb.collection('domains').doc(id).get();
    if (!domSnap.exists) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const domainDoc = domSnap.data();
    if (domainDoc.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const projSnap = await adminDb.collection('projects').doc(domainDoc.projectId).get();
    const vercelProjectId = domainDoc.vercelProjectId || (projSnap.exists ? projSnap.data()?.vercelProjectId : null);

    let verifyResult: any = { verified: false, message: 'Vercel not configured' };
    if (vercelProjectId && VercelService.isConfigured()) {
      verifyResult = await VercelService.verifyDomain(vercelProjectId, domainDoc.domain);
    }

    const now = new Date().toISOString();

    if (verifyResult.verified) {
      await adminDb.collection('domains').doc(id).update({
        verified: true,
        status: 'active',
        dnsRecords: verifyResult.dnsRecords || domainDoc.dnsRecords || [],
        verification: [],
        verifiedAt: now,
        updatedAt: now,
      });

      // If domain is primary or the only domain, update project productionUrl
      if (domainDoc.isPrimary && projSnap.exists) {
        await adminDb.collection('projects').doc(domainDoc.projectId).update({
          productionUrl: `https://${domainDoc.domain}`,
          updatedAt: now,
        });
      }
    } else {
      await adminDb.collection('domains').doc(id).update({
        verified: false,
        status: 'pending',
        dnsRecords: verifyResult.dnsRecords || domainDoc.dnsRecords || [],
        verification: verifyResult.verification || domainDoc.verification || [],
        updatedAt: now,
      });
    }

    res.json({
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
    res.status(500).json({ error: err.message });
  }
});

/**
 * Set domain as primary for project
 */
hostingRouter.post('/domains/:id/primary', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const domSnap = await adminDb.collection('domains').doc(id).get();
    if (!domSnap.exists) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const domainDoc = domSnap.data();
    if (domainDoc.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const now = new Date().toISOString();

    // Mark other domains for this project as not primary
    const siblingSnap = await adminDb.collection('domains').where('projectId', '==', domainDoc.projectId).get();
    for (const doc of siblingSnap.docs) {
      await doc.ref.update({ isPrimary: doc.id === id, updatedAt: now });
    }

    // Update project productionUrl
    await adminDb.collection('projects').doc(domainDoc.projectId).update({
      productionUrl: `https://${domainDoc.domain}`,
      updatedAt: now,
    });

    res.json({ success: true, message: `${domainDoc.domain} is now the primary domain.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Remove custom domain
 */
hostingRouter.delete('/domains/:id', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { adminDb } = getAdminServices();

    const domSnap = await adminDb.collection('domains').doc(id).get();
    if (!domSnap.exists) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const domainDoc = domSnap.data();
    if (domainDoc.userId !== user.uid && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const projSnap = await adminDb.collection('projects').doc(domainDoc.projectId).get();
    const vercelProjectId = projSnap.exists ? projSnap.data()?.vercelProjectId : null;

    if (vercelProjectId && VercelService.isConfigured()) {
      try {
        await VercelService.removeDomainFromProject(vercelProjectId, domainDoc.domain);
      } catch (removeErr: any) {
        console.warn('Vercel domain remove notice:', removeErr.message);
      }
    }

    await adminDb.collection('domains').doc(id).delete();

    // Also remove from project's customDomains list
    if (projSnap.exists) {
      const proj = projSnap.data();
      const updatedDomains = (proj.customDomains || []).filter((d: string) => d !== domainDoc.domain);
      const updates: any = {
        customDomains: updatedDomains,
        updatedAt: new Date().toISOString(),
      };
      if (domainDoc.isPrimary) {
        // If it was primary, fallback to another custom domain or empty
        updates.productionUrl = updatedDomains.length > 0 ? `https://${updatedDomains[0]}` : '';
      }
      await adminDb.collection('projects').doc(domainDoc.projectId).update(updates);
    }

    res.json({ success: true, message: 'Custom domain removed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Maintenance endpoint to purge legacy subdomain collections & records
 */
hostingRouter.post('/migrate-subdomains', async (req, res) => {
  try {
    const { purgeLegacySubdomains } = await import('../migration');
    const result = await purgeLegacySubdomains();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

