/**
 * Domain & Subdomain Management Service
 * Validates domain safety, reserved keywords, Vercel DNS integration, and *.vivexatech.in subdomains.
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROOT_DOMAIN } from '../config/constants';
import { DomainRecord } from '../types';
import { fetchApi } from './apiClient';

export const domainService = {
  /**
   * Validate custom domain format (e.g. mycompany.com or app.mycompany.com)
   */
  validateCustomDomain(domain: string): { valid: boolean; normalized: string; error?: string } {
    const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;

    if (!domainRegex.test(normalized)) {
      return {
        valid: false,
        normalized,
        error: 'Invalid domain format. Enter a domain such as "example.com" or "app.example.com".',
      };
    }

    if (normalized.endsWith(`.${ROOT_DOMAIN}`) || normalized === ROOT_DOMAIN) {
      return {
        valid: false,
        normalized,
        error: 'Free *.vivexatech.in subdomains are discontinued. Please connect your own custom domain.',
      };
    }

    return { valid: true, normalized };
  },

  /**
   * Connect a custom domain to a project via backend Vercel integration
   */
  async addCustomDomain(params: {
    domain: string;
    projectId: string;
    projectName?: string;
    userId?: string;
    vercelProjectId?: string;
  }): Promise<DomainRecord> {
    const validation = this.validateCustomDomain(params.domain);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const res = await fetchApi<{ success: boolean; domain: DomainRecord }>(
      `/api/hosting/projects/${encodeURIComponent(params.projectId)}/custom-domain`,
      {
        method: 'POST',
        body: JSON.stringify({ domain: validation.normalized }),
      }
    );

    return res.domain;
  },

  /**
   * Alias for addCustomDomain
   */
  async attachCustomDomain(userId: string, projectId: string, domainName: string): Promise<DomainRecord> {
    return this.addCustomDomain({
      domain: domainName,
      projectId,
      userId,
    });
  },

  /**
   * Verify DNS records for a domain with Vercel edge
   */
  async verifyCustomDomain(domainId: string): Promise<{ verified: boolean; domain: DomainRecord; message?: string }> {
    const res = await fetchApi<{ verified: boolean; domain: DomainRecord; message?: string }>(
      `/api/hosting/domains/${encodeURIComponent(domainId)}/verify`,
      {
        method: 'POST',
      }
    );

    return res;
  },

  /**
   * Alias for verifyCustomDomain
   */
  async verifyDomain(domainId: string): Promise<{ verified: boolean; domain: DomainRecord; message?: string }> {
    return this.verifyCustomDomain(domainId);
  },

  /**
   * Set a custom domain as the primary production domain for its project
   */
  async setPrimaryDomain(domainId: string): Promise<{ success: boolean; message: string }> {
    return fetchApi<{ success: boolean; message: string }>(
      `/api/hosting/domains/${encodeURIComponent(domainId)}/primary`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Remove custom domain
   */
  async removeDomain(domainId: string, userId?: string): Promise<void> {
    await fetchApi(`/api/hosting/domains/${encodeURIComponent(domainId)}`, {
      method: 'DELETE',
    });
  },

  /**
   * List custom domains for a specific project from Firestore
   */
  async getProjectDomains(projectId: string): Promise<DomainRecord[]> {
    try {
      const q = query(
        collection(db, 'domains'),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }))
        .filter((d) => d.status !== 'removed' && (d as any).type !== 'vivexa_subdomain');
    } catch {
      return [];
    }
  },

  /**
   * List all custom domains belonging to a user from Firestore
   */
  async getUserDomains(userId: string): Promise<DomainRecord[]> {
    try {
      const q = query(
        collection(db, 'domains'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }))
        .filter((d) => d.status !== 'removed' && (d as any).type !== 'vivexa_subdomain');
    } catch {
      return [];
    }
  },
};
