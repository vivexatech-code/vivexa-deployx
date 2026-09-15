/**
 * Plan & Entitlement Service
 * Enforces subscription plan quotas (projects, domains, deployments) server-side and client-side.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_PLANS } from '../config/constants';
import { Plan, Subscription, EntitlementCheckResult } from '../types';

export const planService = {
  /**
   * Fetch all configurable plans from Firestore. Seeds default plans if none exist.
   */
  async getPlans(): Promise<Plan[]> {
    try {
      const plansRef = collection(db, 'plans');
      const snap = await getDocs(plansRef);

      if (snap.empty) {
        // Seed default plans into Firestore
        for (const plan of DEFAULT_PLANS) {
          await setDoc(doc(db, 'plans', plan.id), plan);
        }
        return DEFAULT_PLANS;
      }

      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Plan, 'id'>) }))
        .sort((a, b) => a.price - b.price);
    } catch (err) {
      console.warn('Falling back to default plans:', err);
      return DEFAULT_PLANS;
    }
  },

  /**
   * Get specific plan by ID
   */
  async getPlanById(planId: string): Promise<Plan | null> {
    try {
      const snap = await getDoc(doc(db, 'plans', planId));
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as Omit<Plan, 'id'>) };
      }
      return DEFAULT_PLANS.find((p) => p.id === planId) || null;
    } catch (err) {
      return DEFAULT_PLANS.find((p) => p.id === planId) || null;
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
   */
  async getUserUsage(userId: string): Promise<{
    projectsCount: number;
    domainsCount: number;
    deploymentsCount: number;
    currentPlan: Plan;
    subscription: Subscription | null;
  }> {
    const sub = await this.getUserSubscription(userId);
    let plan = DEFAULT_PLANS[0]; // Defaults to Starter plan entitlement if no paid sub yet

    if (sub) {
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
    };
  },

  /**
   * Enforce limit: can user create another project?
   */
  async canCreateProject(userId: string): Promise<EntitlementCheckResult> {
    const usage = await this.getUserUsage(userId);
    if (usage.projectsCount >= usage.currentPlan.maxProjects) {
      return {
        allowed: false,
        reason: `You've reached your project limit (${usage.projectsCount}/${usage.currentPlan.maxProjects}). Upgrade your plan to create more projects.`,
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
    if (usage.domainsCount >= usage.currentPlan.maxDomains) {
      return {
        allowed: false,
        reason: `You've reached your custom domain limit (${usage.domainsCount}/${usage.currentPlan.maxDomains}). Upgrade your plan to connect more domains.`,
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
    if (usage.deploymentsCount >= usage.currentPlan.maxDeployments) {
      return {
        allowed: false,
        reason: `Monthly deployment quota reached (${usage.deploymentsCount}/${usage.currentPlan.maxDeployments}). Upgrade your plan for higher build volume.`,
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
