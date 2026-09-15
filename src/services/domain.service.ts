/**
 * Domain & Subdomain Management Service
 * Validates domain safety, reserved keywords, Vercel DNS integration, and *.vivexatech.in wildcard subdomains.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { RESERVED_SUBDOMAINS, ROOT_DOMAIN } from '../config/constants';
import { DomainRecord, SubdomainRecord } from '../types';
import { hostingProvider } from './hosting/vercelProvider';
import { planService } from './plan.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';

export const domainService = {
  /**
   * Validate and normalize a subdomain string
   */
  validateSubdomain(subdomain: string): { valid: boolean; normalized: string; error?: string } {
    const normalized = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (!normalized || normalized.length < 3) {
      return { valid: false, normalized, error: 'Subdomain must be at least 3 characters long.' };
    }

    if (normalized.length > 32) {
      return { valid: false, normalized, error: 'Subdomain cannot exceed 32 characters.' };
    }

    if (RESERVED_SUBDOMAINS.has(normalized)) {
      return {
        valid: false,
        normalized,
        error: `The subdomain "${normalized}" is reserved for Vivexa system infrastructure.`,
      };
    }

    return { valid: true, normalized };
  },

  /**
   * Check if a subdomain is already in use
   */
  async isSubdomainAvailable(subdomain: string, excludeProjectId?: string): Promise<boolean> {
    const q = query(
      collection(db, 'subdomains'),
      where('subdomain', '==', subdomain.toLowerCase())
    );
    const snap = await getDocs(q);

    if (snap.empty) return true;
    if (excludeProjectId && snap.docs.length === 1) {
      return snap.docs[0].data().projectId === excludeProjectId;
    }
    return false;
  },

  /**
   * Assign a free Vivexa subdomain to a project
   */
  async assignSubdomain(params: {
    subdomain: string;
    projectId: string;
    userId: string;
  }): Promise<SubdomainRecord> {
    const check = this.validateSubdomain(params.subdomain);
    if (!check.valid) {
      throw new Error(check.error || 'Invalid subdomain.');
    }

    const available = await this.isSubdomainAvailable(check.normalized, params.projectId);
    if (!available) {
      throw new Error(`The subdomain "${check.normalized}.${ROOT_DOMAIN}" is already taken by another project.`);
    }

    const fullSubdomain = `${check.normalized}.${ROOT_DOMAIN}`;
    const subRecord: SubdomainRecord = {
      id: `sub_${check.normalized}`,
      subdomain: check.normalized,
      fullSubdomain,
      projectId: params.projectId,
      userId: params.userId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'subdomains', check.normalized), subRecord);

    // Update project with assigned subdomain
    await updateDoc(doc(db, 'projects', params.projectId), {
      vivexaSubdomain: fullSubdomain,
      updatedAt: new Date().toISOString(),
    });

    return subRecord;
  },

  /**
   * Validate custom domain format (e.g. mycompany.com or app.mycompany.com)
   */
  validateCustomDomain(domain: string): { valid: boolean; normalized: string; error?: string } {
    const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;

    if (!domainRegex.test(normalized)) {
      return { valid: false, normalized, error: 'Invalid domain format. Enter a valid domain such as "example.com" or "app.example.com".' };
    }

    if (normalized.endsWith(`.${ROOT_DOMAIN}`) || normalized === ROOT_DOMAIN) {
      return { valid: false, normalized, error: `To use a vivexatech.in domain, please use the Free Subdomain feature instead.` };
    }

    return { valid: true, normalized };
  },

  /**
   * Connect a custom domain to a project
   */
  async addCustomDomain(params: {
    domain: string;
    projectId: string;
    projectName: string;
    userId: string;
    vercelProjectId?: string;
  }): Promise<DomainRecord> {
    // 1. Plan limit check
    const entitlement = await planService.canAddDomain(params.userId);
    if (!entitlement.allowed) {
      throw new Error(entitlement.reason);
    }

    // 2. Format validation
    const validation = this.validateCustomDomain(params.domain);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const domainName = validation.normalized;

    // 3. Collision check
    const q = query(
      collection(db, 'domains'),
      where('domain', '==', domainName),
      where('status', '!=', 'removed')
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      throw new Error(`The domain "${domainName}" is already connected to another project.`);
    }

    // 4. Register with Hosting Provider (Vercel) if configured
    let dnsRecordType: 'CNAME' | 'A' = domainName.split('.').length > 2 ? 'CNAME' : 'A';
    let dnsHost = dnsRecordType === 'A' ? '@' : domainName.split('.')[0];
    let dnsValue = dnsRecordType === 'A' ? '76.76.21.21' : 'cname.vercel-dns.com';
    let initialStatus: 'pending' | 'active' = 'pending';

    if (hostingProvider.isConfigured() && params.vercelProjectId) {
      try {
        const vResult = await hostingProvider.addDomain(params.vercelProjectId, domainName);
        dnsRecordType = vResult.dnsRecordType;
        dnsHost = vResult.dnsHost;
        dnsValue = vResult.dnsValue;
        if (vResult.verified) initialStatus = 'active';
      } catch (err: any) {
        console.warn('Vercel domain addition returned note:', err.message);
      }
    }

    const domainId = `dom_${Date.now()}`;
    const record: DomainRecord = {
      id: domainId,
      userId: params.userId,
      projectId: params.projectId,
      projectName: params.projectName || 'Project',
      domain: domainName,
      domainName,
      type: 'custom',
      status: initialStatus,
      dnsRecordType,
      dnsHost,
      dnsValue,
      dnsRecords: { type: dnsRecordType, host: dnsHost, value: dnsValue },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'domains', domainId), record);

    await auditService.log({
      userId: params.userId,
      action: 'DOMAIN_ADDED',
      details: { domain: domainName, projectId: params.projectId },
    });

    return record;
  },

  /**
   * Overloaded add domain helper
   */
  async attachCustomDomain(userId: string, projectId: string, domainName: string): Promise<DomainRecord> {
    return this.addCustomDomain({
      domain: domainName,
      projectId,
      projectName: 'Project',
      userId,
    });
  },

  /**
   * Verify DNS records for a domain
   */
  async verifyCustomDomain(domainId: string, vercelProjectId?: string): Promise<DomainRecord> {
    const snap = await getDoc(doc(db, 'domains', domainId));
    if (!snap.exists()) {
      throw new Error('Domain record not found.');
    }

    const record = snap.data() as DomainRecord;

    if (hostingProvider.isConfigured() && vercelProjectId) {
      const vResult = await hostingProvider.verifyDomain(vercelProjectId, record.domain);
      const isVerified = vResult.verified;

      const updatedStatus = isVerified ? 'active' : 'pending';
      const updates: Partial<DomainRecord> = {
        status: updatedStatus,
        verifiedAt: isVerified ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'domains', domainId), updates);

      if (isVerified) {
        await notificationService.send({
          userId: record.userId,
          title: 'Custom Domain Activated! 🚀',
          message: `${record.domain} is now verified and routing traffic to your project.`,
          type: 'success',
          link: `/dashboard/domains`,
        });
      }

      return { ...record, ...updates };
    } else {
      // Demo / instant verification
      const updates: Partial<DomainRecord> = {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'domains', domainId), updates);
      return { ...record, ...updates };
    }
  },

  /**
   * Alias for verifyCustomDomain returning boolean response
   */
  async verifyDomain(domainId: string, vercelProjectId?: string): Promise<{ verified: boolean; message?: string }> {
    try {
      const res = await this.verifyCustomDomain(domainId, vercelProjectId);
      return {
        verified: res.status === 'active',
        message: res.status === 'active' ? 'Domain verified successfully!' : 'DNS record not detected yet.',
      };
    } catch (err: any) {
      return { verified: false, message: err.message };
    }
  },

  /**
   * Remove custom domain
   */
  async removeCustomDomain(domainId: string, vercelProjectId?: string): Promise<void> {
    const snap = await getDoc(doc(db, 'domains', domainId));
    if (!snap.exists()) return;

    const record = snap.data() as DomainRecord;

    if (hostingProvider.isConfigured() && vercelProjectId) {
      await hostingProvider.removeDomain(vercelProjectId, record.domain).catch(() => {});
    }

    await deleteDoc(doc(db, 'domains', domainId));

    await auditService.log({
      userId: record.userId,
      action: 'DOMAIN_REMOVED',
      details: { domain: record.domain, projectId: record.projectId },
    });
  },

  /**
   * Alias for removeCustomDomain
   */
  async removeDomain(domainId: string, _userId?: string): Promise<void> {
    return this.removeCustomDomain(domainId);
  },

  /**
   * Get all domains for user
   */
  async getUserDomains(userId: string): Promise<DomainRecord[]> {
    try {
      const q = query(
        collection(db, 'domains'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }));
    } catch {
      return [];
    }
  },

  /**
   * Get all domains for a specific project
   */
  async getProjectDomains(projectId: string): Promise<DomainRecord[]> {
    try {
      const q = query(
        collection(db, 'domains'),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }));
    } catch {
      return [];
    }
  },
};
