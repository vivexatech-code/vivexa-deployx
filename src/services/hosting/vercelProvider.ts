/**
 * Vercel Hosting Provider Implementation
 * Interacts with the real Vercel REST API v9/v13 for projects, deployments, and domain DNS.
 */

import {
  HostingProvider,
  CreateProjectParams,
  DeployParams,
  HostingDeploymentResult,
  DomainVerificationResult,
} from './hostingProvider';

export class VercelHostingProvider implements HostingProvider {
  name = 'Vercel';
  private token: string;
  private teamId?: string;

  constructor() {
    this.token =
      (typeof process !== 'undefined' && process.env?.VERCEL_TOKEN) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VERCEL_TOKEN) ||
      '';
    this.teamId =
      (typeof process !== 'undefined' && process.env?.VERCEL_TEAM_ID) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VERCEL_TEAM_ID) ||
      '';
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.token.trim().length > 0);
  }

  getMissingCredentialsNotice(): string {
    return 'Vercel integration is not configured. Add VERCEL_TOKEN to your environment variables.';
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private getUrl(path: string): string {
    const url = new URL(`https://api.vercel.com${path}`);
    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }
    return url.toString();
  }

  async createProject(params: CreateProjectParams): Promise<{ id: string; name: string }> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const payload: Record<string, any> = {
      name: params.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    };

    if (params.framework) payload.framework = params.framework;
    if (params.buildCommand) payload.buildCommand = params.buildCommand;
    if (params.outputDirectory) payload.outputDirectory = params.outputDirectory;
    if (params.installCommand) payload.installCommand = params.installCommand;

    if (params.envVars && Object.keys(params.envVars).length > 0) {
      payload.environmentVariables = Object.entries(params.envVars).map(([key, value]) => ({
        key,
        value,
        type: 'plain',
        target: ['production', 'preview', 'development'],
      }));
    }

    const res = await fetch(this.getUrl('/v9/projects'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error (${res.status}): Failed to create project`);
    }

    const data = await res.json();
    return { id: data.id, name: data.name };
  }

  async deploy(params: DeployParams): Promise<HostingDeploymentResult> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const payload = {
      name: params.projectId,
      project: params.projectId,
      gitSource: {
        type: 'github',
        ref: params.gitBranch,
        repo: params.repoUrl,
        sha: params.commitHash,
      },
    };

    const res = await fetch(this.getUrl('/v13/deployments'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error (${res.status}): Failed to trigger deployment`);
    }

    const data = await res.json();
    return {
      deploymentId: data.id,
      url: data.url ? `https://${data.url}` : '',
      status: this.mapVercelStatus(data.readyState),
    };
  }

  async getDeployment(deploymentId: string): Promise<HostingDeploymentResult> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(this.getUrl(`/v13/deployments/${deploymentId}`), {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error (${res.status}): Failed to fetch deployment`);
    }

    const data = await res.json();
    return {
      deploymentId: data.id,
      url: data.url ? `https://${data.url}` : '',
      status: this.mapVercelStatus(data.readyState),
      errorMessage: data.errorMessage,
    };
  }

  async listDeployments(projectId: string): Promise<HostingDeploymentResult[]> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(this.getUrl(`/v6/deployments?projectId=${encodeURIComponent(projectId)}`), {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error: Failed to list deployments`);
    }

    const data = await res.json();
    return (data.deployments || []).map((d: any) => ({
      deploymentId: d.uid,
      url: d.url ? `https://${d.url}` : '',
      status: this.mapVercelStatus(d.state),
      createdAt: d.created,
    }));
  }

  async addDomain(projectId: string, domain: string): Promise<DomainVerificationResult> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains`), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name: domain }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error: Failed to add domain to project`);
    }

    const data = await res.json();
    const verified = Boolean(data.verified);
    const isApex = !domain.includes('.') || domain.split('.').length === 2;

    return {
      verified,
      status: verified ? 'active' : 'pending',
      dnsRecordType: isApex ? 'A' : 'CNAME',
      dnsHost: isApex ? '@' : domain.split('.')[0],
      dnsValue: isApex ? '76.76.21.21' : 'cname.vercel-dns.com',
      message: verified ? 'Domain is verified and active' : 'Configure the DNS record with your registrar.',
    };
  }

  async verifyDomain(projectId: string, domain: string): Promise<DomainVerificationResult> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(
      this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`),
      {
        method: 'POST',
        headers: this.getHeaders(),
      },
    );

    const isApex = !domain.includes('.') || domain.split('.').length === 2;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        verified: false,
        status: 'error',
        dnsRecordType: isApex ? 'A' : 'CNAME',
        dnsHost: isApex ? '@' : domain.split('.')[0],
        dnsValue: isApex ? '76.76.21.21' : 'cname.vercel-dns.com',
        message: err.error?.message || 'DNS verification failed. Check that your DNS record has propagated.',
      };
    }

    const data = await res.json();
    const verified = Boolean(data.verified);

    return {
      verified,
      status: verified ? 'active' : 'pending',
      dnsRecordType: isApex ? 'A' : 'CNAME',
      dnsHost: isApex ? '@' : domain.split('.')[0],
      dnsValue: isApex ? '76.76.21.21' : 'cname.vercel-dns.com',
      message: verified ? 'Domain verified successfully!' : 'DNS record not detected yet. DNS propagation may take up to 24 hours.',
    };
  }

  async removeDomain(projectId: string, domain: string): Promise<{ success: boolean }> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(
      this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`),
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      },
    );

    return { success: res.ok };
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    if (!this.isConfigured()) {
      throw new Error(this.getMissingCredentialsNotice());
    }

    const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}`), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return { success: res.ok };
  }

  private mapVercelStatus(status: string): 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' {
    switch ((status || '').toUpperCase()) {
      case 'READY':
        return 'READY';
      case 'BUILDING':
      case 'INITIALIZING':
        return 'BUILDING';
      case 'QUEUED':
        return 'QUEUED';
      case 'CANCELED':
        return 'CANCELED';
      case 'ERROR':
      default:
        return 'ERROR';
    }
  }
}

export const hostingProvider = new VercelHostingProvider();
