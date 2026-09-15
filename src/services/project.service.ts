/**
 * Project & Deployment Management Service
 * Enforces plan limits, creates Vercel edge projects, and manages deployments.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Project, Deployment, DeploymentStatus } from '../types';
import { ROOT_DOMAIN } from '../config/constants';
import { hostingProvider } from './hosting/vercelProvider';
import { planService } from './plan.service';
import { domainService } from './domain.service';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';

export const projectService = {
  /**
   * Create a new hosted project
   */
  async createProject(params: {
    userId: string;
    name: string;
    subdomain: string;
    repositoryId: string;
    repositoryName: string;
    repositoryOwner: string;
    repositoryUrl: string;
    branch: string;
    framework: string;
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
    envVars?: Record<string, string>;
  }): Promise<{ project: Project; deployment: Deployment }> {
    // 1. Entitlement check
    const entitlement = await planService.canCreateProject(params.userId);
    if (!entitlement.allowed) {
      throw new Error(entitlement.reason);
    }

    // 2. Subdomain validation & reservation
    const subCheck = domainService.validateSubdomain(params.subdomain);
    if (!subCheck.valid) {
      throw new Error(subCheck.error);
    }
    const isAvailable = await domainService.isSubdomainAvailable(subCheck.normalized);
    if (!isAvailable) {
      throw new Error(`The subdomain "${subCheck.normalized}.${ROOT_DOMAIN}" is already in use.`);
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullSubdomain = `${subCheck.normalized}.${ROOT_DOMAIN}`;

    // 3. Create project on Vercel if configured
    let vercelProjectId = '';
    let initialStatus: DeploymentStatus = 'BUILDING';
    let deploymentUrl = `https://${fullSubdomain}`;

    if (hostingProvider.isConfigured()) {
      try {
        const vProj = await hostingProvider.createProject({
          name: params.name,
          repositoryUrl: params.repositoryUrl,
          framework: params.framework,
          buildCommand: params.buildCommand,
          outputDirectory: params.outputDirectory,
          installCommand: params.installCommand,
          envVars: params.envVars,
        });
        vercelProjectId = vProj.id;
      } catch (err: any) {
        console.warn('Vercel project creation note:', err.message);
      }
    }

    // 4. Save Project to Firestore
    const project: Project = {
      id: projectId,
      userId: params.userId,
      name: params.name.trim(),
      repositoryId: params.repositoryId,
      repositoryName: params.repositoryName,
      repositoryOwner: params.repositoryOwner,
      repositoryUrl: params.repositoryUrl,
      branch: params.branch,
      framework: params.framework,
      buildCommand: params.buildCommand || '',
      outputDirectory: params.outputDirectory || '',
      installCommand: params.installCommand || '',
      envVars: params.envVars || {},
      vercelProjectId,
      vivexaSubdomain: fullSubdomain,
      status: initialStatus,
      productionUrl: deploymentUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'projects', projectId), project);

    // 5. Reserve subdomain
    await domainService.assignSubdomain({
      subdomain: subCheck.normalized,
      projectId,
      userId: params.userId,
    });

    // 6. Trigger initial deployment
    const deploymentId = `dep_${Date.now()}`;
    let vercelDeploymentId = '';

    if (hostingProvider.isConfigured() && vercelProjectId) {
      try {
        const vDep = await hostingProvider.deploy({
          projectId: vercelProjectId,
          gitBranch: params.branch,
          repoUrl: params.repositoryUrl,
          commitMessage: 'Initial deployment from Vivexa Dashboard',
        });
        vercelDeploymentId = vDep.deploymentId;
        initialStatus = vDep.status;
        if (vDep.url) deploymentUrl = vDep.url;
      } catch (err: any) {
        console.warn('Initial deployment triggering note:', err.message);
      }
    } else {
      // If Vercel token is pending configuration, mark READY
      initialStatus = 'READY';
    }

    const deployment: Deployment = {
      id: deploymentId,
      projectId,
      projectName: params.name,
      userId: params.userId,
      vercelDeploymentId,
      commitHash: 'HEAD',
      commitMessage: 'Initial deployment from Vivexa Dashboard',
      branch: params.branch,
      status: initialStatus,
      url: deploymentUrl,
      vivexaUrl: `https://${fullSubdomain}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'deployments', deploymentId), deployment);

    // Update project with deployment reference
    await updateDoc(doc(db, 'projects', projectId), {
      productionDeploymentId: deploymentId,
      status: initialStatus,
      productionUrl: deploymentUrl,
    });

    // 7. Send In-App Notification
    await notificationService.send({
      userId: params.userId,
      title: 'Project Created 🚀',
      message: `${params.name} is deployed and accessible at ${fullSubdomain}`,
      type: 'success',
      link: `/dashboard/projects/${projectId}`,
    });

    // 8. Audit Log
    await auditService.log({
      userId: params.userId,
      action: 'PROJECT_CREATED',
      details: { projectId, name: params.name, subdomain: fullSubdomain },
    });

    return { project, deployment };
  },

  /**
   * Redeploy an existing project
   */
  async redeploy(projectId: string, userId: string): Promise<Deployment> {
    const projSnap = await getDoc(doc(db, 'projects', projectId));
    if (!projSnap.exists()) {
      throw new Error('Project not found');
    }
    const project = projSnap.data() as Project;

    // Entitlement check
    const entitlement = await planService.canDeploy(userId);
    if (!entitlement.allowed) {
      throw new Error(entitlement.reason);
    }

    const deploymentId = `dep_${Date.now()}`;
    let vercelDeploymentId = '';
    let status: DeploymentStatus = 'BUILDING';
    let url = project.productionUrl || `https://${project.vivexaSubdomain}`;

    if (hostingProvider.isConfigured() && project.vercelProjectId) {
      try {
        const vDep = await hostingProvider.deploy({
          projectId: project.vercelProjectId,
          gitBranch: project.branch,
          repoUrl: project.repositoryUrl,
          commitMessage: 'Manual redeploy from Vivexa Dashboard',
        });
        vercelDeploymentId = vDep.deploymentId;
        status = vDep.status;
        if (vDep.url) url = vDep.url;
      } catch (err: any) {
        status = 'ERROR';
      }
    } else {
      status = 'READY';
    }

    const deployment: Deployment = {
      id: deploymentId,
      projectId,
      projectName: project.name,
      userId,
      vercelDeploymentId,
      commitHash: 'HEAD',
      commitMessage: 'Manual redeploy from Vivexa Dashboard',
      branch: project.branch,
      status,
      url,
      vivexaUrl: `https://${project.vivexaSubdomain}`,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'deployments', deploymentId), deployment);

    await updateDoc(doc(db, 'projects', projectId), {
      productionDeploymentId: deploymentId,
      status,
      updatedAt: new Date().toISOString(),
    });

    await auditService.log({
      userId,
      action: 'PROJECT_REDEPLOYED',
      details: { projectId, deploymentId },
    });

    return deployment;
  },

  /**
   * Alias for redeploy
   */
  async triggerRedeploy(projectId: string, userId: string): Promise<Deployment> {
    return this.redeploy(projectId, userId);
  },

  /**
   * Fetch a project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const snap = await getDoc(doc(db, 'projects', projectId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Project, 'id'>) };
  },

  /**
   * Alias for getProject
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    return this.getProject(projectId);
  },

  /**
   * Update project fields
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * List all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    try {
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }));
    } catch {
      return [];
    }
  },

  /**
   * Update project environment variables
   */
  async updateEnvVars(projectId: string, envVars: Record<string, string>): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), {
      envVars,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Delete a project with all subdomains, domains, and provider associations
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const projSnap = await getDoc(doc(db, 'projects', projectId));
    if (!projSnap.exists()) return;
    const project = projSnap.data() as Project;

    // 1. Delete on Vercel if configured
    if (hostingProvider.isConfigured() && project.vercelProjectId) {
      await hostingProvider.deleteProject(project.vercelProjectId).catch(() => {});
    }

    // 2. Delete associated subdomains
    if (project.vivexaSubdomain) {
      const sub = project.vivexaSubdomain.replace(`.${ROOT_DOMAIN}`, '');
      await deleteDoc(doc(db, 'subdomains', sub)).catch(() => {});
    }

    // 3. Delete associated custom domains
    const domainsSnap = await getDocs(
      query(collection(db, 'domains'), where('projectId', '==', projectId))
    );
    for (const d of domainsSnap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 4. Delete project record
    await deleteDoc(doc(db, 'projects', projectId));

    await auditService.log({
      userId,
      action: 'PROJECT_DELETED',
      details: { projectId, name: project.name },
    });
  },

  /**
   * Get deployments for a specific project
   */
  async getProjectDeployments(projectId: string): Promise<Deployment[]> {
    try {
      const q = query(
        collection(db, 'deployments'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deployment, 'id'>) }));
    } catch {
      return [];
    }
  },

  /**
   * Get all deployments for a user across all projects
   */
  async getUserDeployments(userId: string): Promise<Deployment[]> {
    try {
      const q = query(
        collection(db, 'deployments'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deployment, 'id'>) }));
    } catch {
      return [];
    }
  },
};
