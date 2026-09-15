/**
 * Vivexa Hosting - Domain & Entity Types
 * Strict TypeScript types for production hosting platform
 */

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  gstin?: string;
  githubConnected?: boolean;
  githubUsername?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // Base price in INR
  billingCycle: 'monthly' | 'yearly';
  gstRate: number; // 0.18
  maxProjects: number;
  maxDomains: number;
  maxSubdomains: number;
  maxDeployments: number;
  storageLimit: string;
  bandwidthLimit: string;
  teamMembers: number;
  features: string[];
  active: boolean;
  highlight?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'payment_failed';

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  status: SubscriptionStatus;
  provider: 'razorpay';
  razorpaySubscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentStatus =
  | 'QUEUED'
  | 'BUILDING'
  | 'READY'
  | 'ERROR'
  | 'CANCELED';

export interface Project {
  id: string;
  userId: string;
  name: string;
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
  vercelProjectId?: string;
  productionDeploymentId?: string;
  productionUrl?: string;
  vivexaSubdomain: string;
  status: DeploymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName?: string;
  userId: string;
  vercelDeploymentId?: string;
  commitHash: string;
  commitMessage: string;
  branch: string;
  status: DeploymentStatus;
  url?: string;
  vivexaUrl?: string;
  errorMessage?: string;
  createdAt: string;
  durationMs?: number;
}

export type DomainStatus =
  | 'pending'
  | 'verifying'
  | 'active'
  | 'error'
  | 'removed';

export interface DomainRecord {
  id: string;
  userId: string;
  projectId: string;
  projectName?: string;
  domain: string;
  domainName?: string;
  type?: string;
  status: DomainStatus;
  dnsRecordType: 'CNAME' | 'A';
  dnsHost: string;
  dnsValue: string;
  dnsRecords?: { type: string; host: string; value: string };
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubdomainRecord {
  id: string;
  subdomain: string;
  fullSubdomain: string;
  projectId: string;
  userId: string;
  status: 'active' | 'reserved' | 'disabled';
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  planId: string;
  planName?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  amount: number; // Final total amount in INR
  subtotal: number;
  gstRate: number; // 0.18
  gstAmount: number;
  currency: string;
  status: 'captured' | 'failed' | 'pending' | 'refunded';
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // VTX-2026-000001
  userId: string;
  paymentId: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  customerName: string;
  customerEmail: string;
  customerGstin?: string;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
  status: 'paid' | 'unpaid' | 'void';
  issuedAt: string;
  pdfReference?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  private: boolean;
  language: string | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface GitHubConnection {
  id: string;
  userId: string;
  githubUserId?: string;
  githubUsername: string;
  githubAvatar?: string;
  provider: 'github';
  connectedAt: string;
  updatedAt?: string;
  scopes?: string[];
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxLimit?: number;
}
