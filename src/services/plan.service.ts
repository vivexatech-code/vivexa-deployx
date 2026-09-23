/**
 * Plan & Entitlement Service
 * Enforces subscription plan quotas (projects, domains, deployments) server-side and client-side.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Plan, Subscription, EntitlementCheckResult } from '../types';

export const planService = {
  /**
   * Fetch all configurable plans from Firestore.
   * Authoritative source of truth: Firebase Firestore.
   * Deduplicates aliases (e.g. starter vs plan_starter).
   */
  async getPlans(): Promise<Plan[]> {
    try {
      const plansRef = collection(db, 'plans');
      const snap = await getDocs(plansRef);

      const seenNames = new Set<string>();
      const plans: Plan[] = [];

      // Sort so 'plan_' preferred or stable
      const docs = snap.docs.slice().sort((a, b) => {
        if (a.id.startsWith('plan_') && !b.id.startsWith('plan_')) return -1;
        if (!a.id.startsWith('plan_') && b.id.startsWith('plan_')) return 1;
        return 0;
      });

      for (const d of docs) {
        const data = d.data();
        const nameKey = (data.name || d.id).toLowerCase();
        if (seenNames.has(nameKey)) continue;
        seenNames.add(nameKey);

        plans.push({
          id: d.id,
          name: data.name || d.id,
          price: Number(data.price ?? 0),
          currency: data.currency || 'INR',
          gstRate: data.gstRate !== undefined ? Number(data.gstRate) : 18,
          razorpayPlanId: data.razorpayPlanId || '',
          active: data.active !== false,
          billingCycle: data.billingCycle || 'monthly',
          maxProjects: Number(data.maxProjects ?? 3),
          maxDomains: Number(data.maxDomains ?? 1),
          maxSubdomains: Number(data.maxSubdomains ?? 0),
          maxDeployments: Number(data.maxDeployments ?? 100),
          storageLimit: data.storageLimit || '1 GB',
          bandwidthLimit: data.bandwidthLimit || '50 GB / mo',
          teamMembers: Number(data.teamMembers ?? 1),
          features: Array.isArray(data.features) ? data.features : [],
          description: data.description || '',
          highlight: Boolean(data.highlight),
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      }

      return plans.sort((a, b) => a.price - b.price);
    } catch (err) {
      console.error('Error fetching plans from Firestore:', err);
      // Attempt backend endpoint fallback
      try {
        const res = await fetch('/api/billing/plans');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.plans)) {
            return data.plans as Plan[];
          }
        }
      } catch {}
      return [];
    }
  },

  /**
   * Get specific plan by ID from Firestore with alias resolution
   */
  async getPlanById(planId: string): Promise<Plan | null> {
    if (!planId) return null;
    const cleanId = planId.trim();

    try {
      // 1. Direct document check
      const snap = await getDoc(doc(db, 'plans', cleanId));
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          name: data.name || snap.id,
          price: Number(data.price ?? 0),
          currency: data.currency || 'INR',
          gstRate: data.gstRate !== undefined ? Number(data.gstRate) : 18,
          razorpayPlanId: data.razorpayPlanId || '',
          active: data.active !== false,
          billingCycle: data.billingCycle || 'monthly',
          maxProjects: Number(data.maxProjects ?? 3),
          maxDomains: Number(data.maxDomains ?? 1),
          maxSubdomains: Number(data.maxSubdomains ?? 0),
          maxDeployments: Number(data.maxDeployments ?? 100),
          storageLimit: data.storageLimit || '1 GB',
          bandwidthLimit: data.bandwidthLimit || '50 GB / mo',
          teamMembers: Number(data.teamMembers ?? 1),
          features: Array.isArray(data.features) ? data.features : [],
          description: data.description || '',
          highlight: Boolean(data.highlight),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }

      // 2. Try alternate prefix
      const altId = cleanId.startsWith('plan_')
        ? cleanId.replace('plan_', '')
        : `plan_${cleanId}`;
      const altSnap = await getDoc(doc(db, 'plans', altId));
      if (altSnap.exists()) {
        const data = altSnap.data();
        return {
          id: altSnap.id,
          name: data.name || altSnap.id,
          price: Number(data.price ?? 0),
          currency: data.currency || 'INR',
          gstRate: data.gstRate !== undefined ? Number(data.gstRate) : 18,
          razorpayPlanId: data.razorpayPlanId || '',
          active: data.active !== false,
          billingCycle: data.billingCycle || 'monthly',
          maxProjects: Number(data.maxProjects ?? 3),
          maxDomains: Number(data.maxDomains ?? 1),
          maxSubdomains: Number(data.maxSubdomains ?? 0),
          maxDeployments: Number(data.maxDeployments ?? 100),
          storageLimit: data.storageLimit || '1 GB',
          bandwidthLimit: data.bandwidthLimit || '50 GB / mo',
          teamMembers: Number(data.teamMembers ?? 1),
          features: Array.isArray(data.features) ? data.features : [],
          description: data.description || '',
          highlight: Boolean(data.highlight),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }

      // 3. Match from full list
      const plans = await this.getPlans();
      return (
        plans.find(
          (p) =>
            p.id.toLowerCase() === cleanId.toLowerCase() ||
            p.name.toLowerCase() === cleanId.toLowerCase()
        ) || null
      );
    } catch (err) {
      console.error(`Error fetching plan "${cleanId}":`, err);
      return null;
    }
  },

  /**
   * Admin: Update plan pricing, limits, or features
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    await updateDoc(planRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Fetch active user subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const subRef = collection(db, 'subscriptions');
      const q = query(
        subRef,
        where('userId', '==', userId),
        where('status', 'in', ['active', 'past_due'])
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...(d.data() as Omit<Subscription, 'id'>) };
      }
      return null;
    } catch (err) {
      console.warn('Error fetching subscription:', err);
      return null;
    }
  },

  /**
   * Get user usage statistics (projects count, domains count, deployments count)
   * Strictly payment-first: returns currentPlan as null if no verified active subscription.
   */
  async getUserUsage(userId: string): Promise<{
    projectsCount: number;
    domainsCount: number;
    deploymentsCount: number;
    currentPlan: Plan | null;
    subscription: Subscription | null;
    hasActiveSubscription: boolean;
  }> {
    const sub = await this.getUserSubscription(userId);
    let plan: Plan | null = null;
    const hasActiveSubscription = !!(sub && sub.status === 'active');

    if (hasActiveSubscription && sub?.planId) {
      const foundPlan = await this.getPlanById(sub.planId);
      if (foundPlan) plan = foundPlan;
    }

    // Projects count
    const projectsSnap = await getDocs(
      query(collection(db, 'projects'), where('userId', '==', userId))
    );
    const projectsCount = projectsSnap.size;

    // Domains count
    const domainsSnap = await getDocs(
      query(collection(db, 'domains'), where('userId', '==', userId), where('status', '!=', 'removed'))
    );
    const domainsCount = domainsSnap.size;

    // Deployments count
    const deploymentsSnap = await getDocs(
      query(collection(db, 'deployments'), where('userId', '==', userId))
    );
    const deploymentsCount = deploymentsSnap.size;

    return {
      projectsCount,
      domainsCount,
      deploymentsCount,
      currentPlan: plan,
      subscription: sub,
      hasActiveSubscription,
    };
  },

  /**
   * Enforce limit: can user create another project?
   */
  async canCreateProject(userId: string): Promise<EntitlementCheckResult> {
    const usage = await this.getUserUsage(userId);
    if (!usage.hasActiveSubscription || !usage.currentPlan) {
      return {
        allowed: false,
        reason: 'Please select and activate a subscription plan before creating or deploying projects.',
        currentCount: usage.projectsCount,
        maxLimit: 0,
      };
    }

    if (usage.projectsCount >= usage.currentPlan.maxProjects) {
      return {
        allowed: false,
        reason: `You've reached your ${usage.currentPlan.name} plan project limit (${usage.projectsCount}/${usage.currentPlan.maxProjects}). Upgrade your plan to create more projects.`,
        currentCount: usage.projectsCount,
        maxLimit: usage.currentPlan.maxProjects,
      };
    }
    return {
      allowed: true,
      currentCount: usage.projectsCount,
      maxLimit: usage.currentPlan.maxProjects,
    };
  },

  /**
   * Enforce limit: can user connect another domain?
   */
  async canAddDomain(userId: string): Promise<EntitlementCheckResult> {
    const usage = await this.getUserUsage(userId);
    if (!usage.hasActiveSubscription || !usage.currentPlan) {
      return {
        allowed: false,
        reason: 'Please select and activate a subscription plan before connecting custom domains.',
        currentCount: usage.domainsCount,
        maxLimit: 0,
      };
    }

    if (usage.domainsCount >= usage.currentPlan.maxDomains) {
      return {
        allowed: false,
        reason: `You've reached your ${usage.currentPlan.name} custom domain limit (${usage.domainsCount}/${usage.currentPlan.maxDomains}). Upgrade your plan to connect more domains.`,
        currentCount: usage.domainsCount,
        maxLimit: usage.currentPlan.maxDomains,
      };
    }
    return {
      allowed: true,
      currentCount: usage.domainsCount,
      maxLimit: usage.currentPlan.maxDomains,
    };
  },

  /**
   * Enforce limit: can user trigger a deployment?
   */
  async canDeploy(userId: string): Promise<EntitlementCheckResult> {
    const usage = await this.getUserUsage(userId);
    if (!usage.hasActiveSubscription || !usage.currentPlan) {
      return {
        allowed: false,
        reason: 'Please select and activate a plan before deploying.',
        currentCount: usage.deploymentsCount,
        maxLimit: 0,
      };
    }

    if (usage.deploymentsCount >= usage.currentPlan.maxDeployments) {
      return {
        allowed: false,
        reason: `Monthly deployment quota reached for ${usage.currentPlan.name} (${usage.deploymentsCount}/${usage.currentPlan.maxDeployments}). Upgrade your plan for higher build volume.`,
        currentCount: usage.deploymentsCount,
        maxLimit: usage.currentPlan.maxDeployments,
      };
    }
    return {
      allowed: true,
      currentCount: usage.deploymentsCount,
      maxLimit: usage.currentPlan.maxDeployments,
    };
  },
};
