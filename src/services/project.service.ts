/**
 * Project Service
 * Orchestrates project creation, deployments, environment settings, and project lifecycles.
 * Communicates with backend hosting routes for automated Vercel provisioning and edge subdomain routing.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchApi } from './apiClient';
import { Project, Deployment } from '../types';

export const projectService = {
  /**
   * Create a new hosting project end-to-end via secure backend API.
   * Creates the Vercel project, triggers edge deployment, and returns deployment details.
   */
  async createProject(params: {
    userId: string;
    name: string;
    subdomain?: string;
    repositoryId?: string;
    repositoryName?: string;
    repositoryOwner?: string;
    repositoryUrl?: string;
    rootDirectory?: string;
    branch?: string;
    framework?: string;
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
    envVars?: Record<string, string>;
  }): Promise<{ project: Project; deployment: Deployment }> {
    const result = await fetchApi<{
      success: boolean;
      project: Project;
      deployment: Deployment;
    }>('/api/hosting/create-project', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        repositoryId: params.repositoryId,
        repositoryName: params.repositoryName,
        repositoryOwner: params.repositoryOwner,
        repositoryUrl: params.repositoryUrl,
        rootDirectory: params.rootDirectory,
        framework: params.framework,
        buildCommand: params.buildCommand,
        outputDirectory: params.outputDirectory,
        installCommand: params.installCommand,
        envVars: params.envVars,
        gitBranch: params.branch,
      }),
    });

    return {
      project: result.project,
      deployment: result.deployment,
    };
  },

  /**
   * Trigger redeployment of an existing project via backend
   */
  async redeploy(projectId: string, userId: string, branch?: string, commitMessage?: string): Promise<Deployment> {
    const result = await fetchApi<{ success: boolean; deployment: Deployment }>(
      `/api/hosting/projects/${encodeURIComponent(projectId)}/deploy`,
      {
        method: 'POST',
        body: JSON.stringify({ branch, commitMessage, userId }),
      }
    );

    return result.deployment;
  },

  /**
   * Alias for redeploy
   */
  async triggerRedeploy(projectId: string, userId: string): Promise<Deployment> {
    return this.redeploy(projectId, userId);
  },

  /**
   * Sync project deployment and domain status with Vercel
   */
  async syncProject(projectId: string): Promise<any> {
    return await fetchApi(`/api/hosting/projects/${encodeURIComponent(projectId)}/sync`);
  },

  /**
   * Fetch a project by ID from Firestore
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
   * Delete a project with all subdomains, domains, and provider associations via backend
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    await fetchApi(`/api/hosting/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
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
