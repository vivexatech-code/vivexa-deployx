/**
 * Hosting Provider Abstraction Interface
 * Decouples Vivexa core from Vercel so alternative infrastructure providers can be plugged in.
 */

export interface CreateProjectParams {
  name: string;
  repositoryUrl: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  envVars?: Record<string, string>;
}

export interface DeployParams {
  projectId: string;
  gitBranch: string;
  repoUrl: string;
  commitHash?: string;
  commitMessage?: string;
}

export interface HostingDeploymentResult {
  deploymentId: string;
  url: string;
  status: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  errorMessage?: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  status: 'active' | 'pending' | 'error';
  dnsRecordType: 'CNAME' | 'A';
  dnsHost: string;
  dnsValue: string;
  message?: string;
}

export interface HostingProvider {
  name: string;
  isConfigured(): boolean;
  getMissingCredentialsNotice(): string;
  createProject(params: CreateProjectParams): Promise<{ id: string; name: string }>;
  deploy(params: DeployParams): Promise<HostingDeploymentResult>;
  getDeployment(deploymentId: string): Promise<HostingDeploymentResult>;
  listDeployments(projectId: string): Promise<HostingDeploymentResult[]>;
  addDomain(projectId: string, domain: string): Promise<DomainVerificationResult>;
  verifyDomain(projectId: string, domain: string): Promise<DomainVerificationResult>;
  removeDomain(projectId: string, domain: string): Promise<{ success: boolean }>;
  deleteProject(projectId: string): Promise<{ success: boolean }>;
}
