/**
 * Server-side Vercel Service
 * Interacts directly with Vercel REST API v9/v13 using server-side VERCEL_TOKEN and VERCEL_TEAM_ID.
 * Deploys full source repositories directly to Vercel's edge network via real Git file trees.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { tokenStore } from '../github/tokenStore';

export interface VercelProjectConfig {
  name: string;
  framework?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  installCommand?: string | null;
  rootDirectory?: string | null;
  environmentVariables?: Record<string, string>;
  gitRepository?: {
    type: 'github';
    repo: string;
  };
}

export interface CreateDeploymentParams {
  projectId: string;
  projectName: string;
  subdomain?: string;
  branch?: string;
  repoOwner?: string;
  repoName?: string;
  rootDirectory?: string;
  framework?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  installCommand?: string | null;
  userId?: string;
  githubToken?: string;
  files?: Array<{ file: string; data?: string; encoding?: string }>;
}

export class VercelService {
  private static getToken(): string {
    return process.env.VERCEL_TOKEN || '';
  }

  private static getTeamId(): string {
    return process.env.VERCEL_TEAM_ID || '';
  }

  public static isConfigured(): boolean {
    return Boolean(this.getToken() && this.getToken().trim().length > 0);
  }

  private static getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  private static getUrl(apiPath: string, queryParams: Record<string, string> = {}): string {
    const teamId = this.getTeamId();
    const url = new URL(`https://api.vercel.com${apiPath}`);
    if (teamId) {
      url.searchParams.set('teamId', teamId);
    }
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }

  /**
   * Create a project in Vercel with optional framework and root directory settings
   */
  public static async createProject(config: VercelProjectConfig): Promise<{ id: string; name: string }> {
    if (!this.isConfigured()) {
      throw new Error('VERCEL_TOKEN is not configured on the server.');
    }

    const sanitizedName = config.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    const payload: Record<string, any> = {
      name: sanitizedName,
    };

    if (config.framework) {
      payload.framework = config.framework;
    }
    if (config.buildCommand) {
      payload.buildCommand = config.buildCommand;
    }
    if (config.outputDirectory) {
      payload.outputDirectory = config.outputDirectory;
    }
    if (config.installCommand) {
      payload.installCommand = config.installCommand;
    }
    if (config.rootDirectory) {
      payload.rootDirectory = config.rootDirectory.replace(/^\/+|\/+$/g, '');
    }

    if (config.environmentVariables && Object.keys(config.environmentVariables).length > 0) {
      payload.environmentVariables = Object.entries(config.environmentVariables).map(([key, value]) => ({
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errCode = data.error?.code;
      const errMsg = (data.error?.message || '').toLowerCase();
      if (
        res.status === 409 ||
        res.status === 400 && errMsg.includes('already exists') ||
        errCode === 'project_already_exists' ||
        errMsg.includes('already exists')
      ) {
        console.log(`Vercel project "${sanitizedName}" already exists. Adopting and updating project configuration.`);
        const existing = await this.getProject(sanitizedName);
        if (existing && existing.id) {
          await this.updateProject(existing.id, {
            framework: config.framework,
            buildCommand: config.buildCommand,
            outputDirectory: config.outputDirectory,
            installCommand: config.installCommand,
            rootDirectory: config.rootDirectory,
          });
          return { id: existing.id, name: existing.name };
        }
      }

      throw new Error(data.error?.message || `Vercel create project failed with status ${res.status}`);
    }

    return { id: data.id, name: data.name };
  }

  /**
   * Get an existing Vercel project by ID or Name
   */
  public static async getProject(projectIdOrName: string): Promise<any | null> {
    if (!this.isConfigured()) return null;

    try {
      const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectIdOrName)}`), {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Update configuration on an existing Vercel project
   */
  public static async updateProject(
    projectIdOrName: string,
    updates: {
      framework?: string | null;
      buildCommand?: string | null;
      outputDirectory?: string | null;
      installCommand?: string | null;
      rootDirectory?: string | null;
    }
  ): Promise<any | null> {
    if (!this.isConfigured()) return null;

    try {
      const payload: Record<string, any> = {};
      if (updates.framework !== undefined) payload.framework = updates.framework;
      if (updates.buildCommand !== undefined) payload.buildCommand = updates.buildCommand;
      if (updates.outputDirectory !== undefined) payload.outputDirectory = updates.outputDirectory;
      if (updates.installCommand !== undefined) payload.installCommand = updates.installCommand;
      if (updates.rootDirectory !== undefined) {
        payload.rootDirectory = updates.rootDirectory ? updates.rootDirectory.replace(/^\/+|\/+$/g, '') : null;
      }

      const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectIdOrName)}`), {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Build DNS instructions combining Vercel configuration and verification challenges
   */
  public static async buildDnsRecords(
    projectId: string,
    domain: string,
    verification?: any[]
  ): Promise<Array<{ type: 'A' | 'CNAME' | 'TXT'; host: string; value: string; status?: string; reason?: string }>> {
    const cleanDomain = domain.toLowerCase().trim();
    const records: Array<{ type: 'A' | 'CNAME' | 'TXT'; host: string; value: string; status?: string; reason?: string }> = [];

    // 1. Check if Vercel returned specific ownership verification challenges (TXT)
    if (Array.isArray(verification)) {
      for (const v of verification) {
        if (v && v.type && v.value) {
          records.push({
            type: v.type.toUpperCase() as any,
            host: v.domain || '_vercel',
            value: v.value,
            status: 'required',
            reason: v.reason || 'Domain ownership verification required by Vercel',
          });
        }
      }
    }

    // 2. Fetch Vercel's real DNS configuration requirements for this domain
    let configData: any = null;
    try {
      const configRes = await fetch(this.getUrl(`/v6/domains/${encodeURIComponent(cleanDomain)}/config`), {
        headers: this.getHeaders(),
      });
      if (configRes.ok) {
        configData = await configRes.json().catch(() => null);
      }
    } catch {
      // ignore
    }

    // 3. Determine if Apex domain or Subdomain
    const domainParts = cleanDomain.split('.');
    const isApex = domainParts.length === 2 || (domainParts.length === 3 && domainParts[1].length <= 3 && domainParts[2].length <= 3);

    if (isApex) {
      const aTarget = (configData?.aValues && configData.aValues[0]) || '76.76.21.21';
      records.push({
        type: 'A',
        host: '@',
        value: aTarget,
        status: configData?.misconfigured === false ? 'valid' : 'pending',
        reason: 'Points your root apex domain to Vercel Anycast Edge Network',
      });
    } else {
      const subPrefix = domainParts[0];
      const cnameTarget = (configData?.cnames && configData.cnames[0]) || 'cname.vercel-dns.com';
      records.push({
        type: 'CNAME',
        host: subPrefix,
        value: cnameTarget,
        status: configData?.misconfigured === false ? 'valid' : 'pending',
        reason: 'Routes traffic to Vercel Edge CDN',
      });
    }

    return records;
  }

  /**
   * Add a domain or subdomain to a Vercel project
   */
  public static async addDomainToProject(
    projectId: string,
    domain: string
  ): Promise<{
    name: string;
    verified: boolean;
    verification?: any[];
    dnsRecords?: Array<{ type: 'A' | 'CNAME' | 'TXT'; host: string; value: string; status?: string; reason?: string }>;
  }> {
    if (!this.isConfigured()) {
      throw new Error('VERCEL_TOKEN is not configured.');
    }

    const cleanDomain = domain.toLowerCase().trim();
    const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains`), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name: cleanDomain }),
    });

    const data = await res.json().catch(() => ({}));
    let domainName = cleanDomain;
    let verified = false;
    let verification: any[] = [];

    if (!res.ok) {
      const errMsg = (data.error?.message || '').toLowerCase();
      if (
        res.status === 409 ||
        data.error?.code === 'domain_already_exists' ||
        errMsg.includes('already exists') ||
        errMsg.includes('already attached')
      ) {
        const getRes = await fetch(
          this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(cleanDomain)}`),
          { headers: this.getHeaders() }
        );
        if (getRes.ok) {
          const existing = await getRes.json();
          domainName = existing.name || cleanDomain;
          verified = Boolean(existing.verified);
          verification = existing.verification || [];
        } else {
          throw new Error(data.error?.message || `Domain "${cleanDomain}" is already in use.`);
        }
      } else {
        throw new Error(data.error?.message || `Failed to add domain "${cleanDomain}" to Vercel project (${res.status})`);
      }
    } else {
      domainName = data.name || cleanDomain;
      verified = Boolean(data.verified);
      verification = data.verification || [];
    }

    const dnsRecords = await this.buildDnsRecords(projectId, domainName, verification);

    return {
      name: domainName,
      verified,
      verification,
      dnsRecords,
    };
  }

  /**
   * Check / trigger domain verification
   */
  public static async verifyDomain(
    projectId: string,
    domain: string
  ): Promise<{
    verified: boolean;
    verification?: any[];
    dnsRecords?: Array<{ type: 'A' | 'CNAME' | 'TXT'; host: string; value: string; status?: string; reason?: string }>;
    message?: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('VERCEL_TOKEN is not configured.');
    }

    const cleanDomain = domain.toLowerCase().trim();
    const verifyRes = await fetch(
      this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(cleanDomain)}/verify`),
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    const data = await verifyRes.json().catch(() => ({}));
    const verified = Boolean(data.verified);
    const verification = data.verification || [];

    const dnsRecords = await this.buildDnsRecords(projectId, cleanDomain, verification);

    return {
      verified,
      verification,
      dnsRecords,
      message: verified ? 'Domain verified successfully! SSL is active.' : (data.error?.message || 'DNS verification pending propagation'),
    };
  }

  /**
   * Get comprehensive domain status and DNS config from Vercel
   */
  public static async getDomainStatus(
    projectId: string,
    domain: string
  ): Promise<{
    name: string;
    verified: boolean;
    verification?: any[];
    misconfigured?: boolean;
    cnames?: string[];
  }> {
    if (!this.isConfigured()) {
      return { name: domain, verified: false };
    }

    const [domainRes, configRes] = await Promise.all([
      fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`), {
        headers: this.getHeaders(),
      }).catch(() => null),
      fetch(this.getUrl(`/v6/domains/${encodeURIComponent(domain)}/config`), {
        headers: this.getHeaders(),
      }).catch(() => null),
    ]);

    const domainData = domainRes && domainRes.ok ? await domainRes.json().catch(() => ({})) : {};
    const configData = configRes && configRes.ok ? await configRes.json().catch(() => ({})) : {};

    return {
      name: domain,
      verified: Boolean(domainData.verified),
      verification: domainData.verification,
      misconfigured: Boolean(configData.misconfigured),
      cnames: configData.cnames,
    };
  }

  /**
   * Remove a domain from a Vercel project
   */
  public static async removeDomainFromProject(projectId: string, domain: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const res = await fetch(
      this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`),
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );
    return res.ok;
  }

  /**
   * Create a real deployment on Vercel containing the actual repository source code.
   */
  public static async createDeployment(
    params: CreateDeploymentParams
  ): Promise<{ id: string; url: string; readyState: string }> {
    if (!this.isConfigured()) {
      throw new Error('VERCEL_TOKEN is not configured on the server.');
    }

    const cleanRootDir = (params.rootDirectory || '').replace(/^\/+|\/+$/g, '').trim();
    const branch = params.branch || 'main';

    let filesManifest: Array<{ file: string; sha: string; size: number }> = [];
    const fileBufferMap = new Map<string, Buffer>();

    const tmpDir = path.join(os.tmpdir(), `vdeploy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    try {
      if (params.repoOwner && params.repoName) {
        fs.mkdirSync(tmpDir, { recursive: true });

        let ghToken = params.githubToken;
        if (!ghToken && params.userId) {
          const stored = await tokenStore.getToken(params.userId);
          if (stored && stored.token && stored.token !== 'demo_simulated_token') {
            ghToken = stored.token;
          }
        }

        const ghHeaders: Record<string, string> = {
          'User-Agent': 'Vivexa-DeployX',
        };
        if (ghToken) {
          ghHeaders['Authorization'] = `Bearer ${ghToken}`;
        }

        const tarballUrl = `https://api.github.com/repos/${params.repoOwner}/${params.repoName}/tarball/${encodeURIComponent(branch)}`;
        const tarRes = await fetch(tarballUrl, { headers: ghHeaders });

        if (!tarRes.ok) {
          throw new Error(`Failed to download repository from GitHub: HTTP ${tarRes.status} (${tarRes.statusText})`);
        }

        const tarArrayBuffer = await tarRes.arrayBuffer();
        const tarPath = path.join(tmpDir, 'repo.tar.gz');
        fs.writeFileSync(tarPath, Buffer.from(tarArrayBuffer));

        const extractDir = path.join(tmpDir, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });
        execSync(`tar -xzf "${tarPath}" -C "${extractDir}" --strip-components=1`);

        const sourceDir = cleanRootDir ? path.join(extractDir, cleanRootDir) : extractDir;
        if (!fs.existsSync(sourceDir)) {
          throw new Error(`Specified root directory "${cleanRootDir}" was not found in the repository.`);
        }

        const IGNORED_NAMES = new Set([
          'node_modules',
          '.git',
          '.next',
          'dist',
          '.vercel',
          '.cache',
          '.turbo',
          '.DS_Store',
          'Thumbs.db',
          '.gitmodules',
          '.github',
        ]);

        const collectFiles = (dir: string, baseDir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (IGNORED_NAMES.has(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              collectFiles(fullPath, baseDir);
            } else if (entry.isFile()) {
              const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
              const buffer = fs.readFileSync(fullPath);
              const sha = crypto.createHash('sha1').update(buffer).digest('hex');
              filesManifest.push({
                file: relPath,
                sha,
                size: buffer.length,
              });
              fileBufferMap.set(sha, buffer);
            }
          }
        };

        collectFiles(sourceDir, sourceDir);
      } else if (params.files && params.files.length > 0) {
        for (const item of params.files) {
          const buffer = Buffer.from(item.data || '', item.encoding === 'base64' ? 'base64' : 'utf-8');
          const sha = crypto.createHash('sha1').update(buffer).digest('hex');
          filesManifest.push({
            file: item.file,
            sha,
            size: buffer.length,
          });
          fileBufferMap.set(sha, buffer);
        }
      }

      if (filesManifest.length === 0) {
        throw new Error('No deployable source files found in repository.');
      }

      const projectSettings: Record<string, any> = {
        framework: params.framework !== undefined ? params.framework : null,
      };
      if (params.buildCommand !== undefined) {
        projectSettings.buildCommand = params.buildCommand;
      }
      if (params.outputDirectory !== undefined) {
        projectSettings.outputDirectory = params.outputDirectory;
      }
      if (params.installCommand !== undefined) {
        projectSettings.installCommand = params.installCommand;
      }
      projectSettings.rootDirectory = null;

      const sanitizedDeployName = params.projectName
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .substring(0, 80);

      let deployRes = await fetch(this.getUrl('/v13/deployments', { skipAutoDetectionConfirmation: '1' }), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: sanitizedDeployName,
          project: params.projectId,
          files: filesManifest,
          target: 'production',
          projectSettings,
        }),
      });

      let deployData = await deployRes.json().catch(() => ({}));

      if (deployData.error?.code === 'missing_files' && Array.isArray(deployData.error.missing)) {
        const missingShas: string[] = deployData.error.missing;

        for (const sha of missingShas) {
          const buffer = fileBufferMap.get(sha);
          if (!buffer) continue;

          const uploadRes = await fetch(this.getUrl('/v2/files'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.getToken()}`,
              'Content-Type': 'application/octet-stream',
              'x-vercel-digest': sha,
              'Content-Length': String(buffer.length),
            },
            body: buffer,
          });

          if (!uploadRes.ok) {
            console.warn(`Warning: file upload for ${sha} returned HTTP ${uploadRes.status}`);
          }
        }

        deployRes = await fetch(this.getUrl('/v13/deployments', { skipAutoDetectionConfirmation: '1' }), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: sanitizedDeployName,
            project: params.projectId,
            files: filesManifest,
            target: 'production',
            projectSettings,
          }),
        });

        deployData = await deployRes.json().catch(() => ({}));
      }

      if (!deployRes.ok) {
        throw new Error(deployData.error?.message || `Vercel deployment creation failed (${deployRes.status})`);
      }

      const deploymentId = deployData.id;
      const deploymentUrl = deployData.url ? `https://${deployData.url}` : '';
      const readyState = deployData.readyState || 'BUILDING';

      return {
        id: deploymentId,
        url: deploymentUrl,
        readyState,
      };
    } finally {
      try {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Get deployment status
   */
  public static async getDeployment(deploymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('VERCEL_TOKEN is not configured.');
    }

    const res = await fetch(this.getUrl(`/v13/deployments/${deploymentId}`), {
      headers: this.getHeaders(),
    });

    return await res.json();
  }

  /**
   * Delete a project from Vercel
   */
  public static async deleteProject(projectId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const res = await fetch(this.getUrl(`/v9/projects/${encodeURIComponent(projectId)}`), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return res.ok;
  }
}
