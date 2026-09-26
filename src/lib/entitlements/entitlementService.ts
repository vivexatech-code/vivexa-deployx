/**
 * Server-side Entitlement Service
 * Enforces subscription plan limits on projects, custom domains, and deployments.
 * 
 * STRICT PAYMENT-FIRST ARCHITECTURE:
 * Account creation does NOT grant any paid plan.
 * Absence of an active, paid, unexpired subscription record results in NO plan (null).
 * All deployments, project creations, and custom domains require a server-verified active subscription.
 */

import { getPlanFromFirebase, FirebasePlan } from '../plans/plansData';

export interface EntitlementResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxLimit: number;
  plan: FirebasePlan | null;
  requiresUpgrade?: boolean;
}

export class EntitlementService {
  /**
   * Retrieves the user's authoritative, verified active subscription.
   */
  public static async getUserActiveSubscription(adminDb: any, userId: string): Promise<any | null> {
    try {
      const subSnap = await adminDb
        .collection('subscriptions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (subSnap.empty) {
        return null;
      }

      const subData = subSnap.docs[0].data();

      // Verify paymentStatus or razorpayPaymentId
      const isPaid = subData.paymentStatus === 'paid' || !!subData.razorpayPaymentId;
      if (!isPaid) {
        console.warn(`[Entitlement] User ${userId} has subscription ${subSnap.docs[0].id} without verified payment.`);
        return null;
      }

      // Verify expiration period if currentPeriodEnd is provided
      if (subData.currentPeriodEnd) {
        const periodEnd = new Date(subData.currentPeriodEnd).getTime();
        if (Number.isFinite(periodEnd) && periodEnd < Date.now()) {
          console.warn(`[Entitlement] User ${userId} subscription expired on ${subData.currentPeriodEnd}.`);
          return null;
        }
      }

      const planId = subData.planId;
      if (!planId) {
        console.warn(`[Entitlement] User ${userId} has empty planId`);
        return null;
      }

      const plan = await getPlanFromFirebase(planId);
      if (!plan) {
        console.warn(`[Entitlement] User ${userId} has unconfigured planId: ${planId}`);
        return null;
      }

      return subData;
    } catch (err) {
      console.warn('Error verifying active subscription in EntitlementService:', err);
      return null;
    }
  }

  /**
   * Retrieves the authoritative plan for the user based strictly on verified active subscription.
   * Returns null if the user has no active paid subscription.
   */
  public static async getUserPlan(adminDb: any, userId: string): Promise<FirebasePlan | null> {
    const sub = await this.getUserActiveSubscription(adminDb, userId);
    if (!sub || !sub.planId) {
      return null;
    }
    return await getPlanFromFirebase(sub.planId);
  }

  /**
   * Enforces project creation limits.
   */
  public static async canCreateProject(
    adminDb: any,
    userId: string
  ): Promise<EntitlementResult> {
    const plan = await this.getUserPlan(adminDb, userId);

    if (!plan) {
      return {
        allowed: false,
        reason: 'Please select and activate a subscription plan before creating or deploying projects.',
        currentCount: 0,
        maxLimit: 0,
        plan: null,
        requiresUpgrade: true,
      };
    }

    const projectsSnap = await adminDb
      .collection('projects')
      .where('userId', '==', userId)
      .get();

    const currentCount = projectsSnap.size;
    if (currentCount >= plan.maxProjects) {
      return {
        allowed: false,
        reason: `Your current ${plan.name} plan limit is reached (${currentCount}/${plan.maxProjects} projects). Upgrade your plan to deploy more projects.`,
        currentCount,
        maxLimit: plan.maxProjects,
        plan,
        requiresUpgrade: true,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxLimit: plan.maxProjects,
      plan,
    };
  }

  /**
   * Enforces deployment permissions.
   */
  public static async canDeploy(
    adminDb: any,
    userId: string
  ): Promise<EntitlementResult> {
    const plan = await this.getUserPlan(adminDb, userId);

    if (!plan) {
      return {
        allowed: false,
        reason: 'Please select and activate a plan before deploying.',
        currentCount: 0,
        maxLimit: 0,
        plan: null,
        requiresUpgrade: true,
      };
    }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const deploymentsSnap = await adminDb
        .collection('deployments')
        .where('userId', '==', userId)
        .where('createdAt', '>=', thirtyDaysAgo)
        .get();

      const currentCount = deploymentsSnap.size;
      if (currentCount >= plan.maxDeployments) {
        return {
          allowed: false,
          reason: `Your current ${plan.name} plan monthly deployment limit is reached (${currentCount}/${plan.maxDeployments} builds). Upgrade your plan to continue deploying.`,
          currentCount,
          maxLimit: plan.maxDeployments,
          plan,
          requiresUpgrade: true,
        };
      }

      return {
        allowed: true,
        currentCount,
        maxLimit: plan.maxDeployments,
        plan,
      };
    } catch (err) {
      console.error('Deployment limit check failed:', err);
      return {
        allowed: false,
        reason: 'Could not verify your deployment limit. Try again in a moment.',
        currentCount: 0,
        maxLimit: plan.maxDeployments,
        plan,
      };
    }
  }

  /**
   * Enforces custom domain connection permissions.
   */
  public static async canAddCustomDomain(
    adminDb: any,
    userId: string
  ): Promise<EntitlementResult> {
    const plan = await this.getUserPlan(adminDb, userId);

    if (!plan) {
      return {
        allowed: false,
        reason: 'Please select and activate a subscription plan before connecting custom domains.',
        currentCount: 0,
        maxLimit: 0,
        plan: null,
        requiresUpgrade: true,
      };
    }

    const domainsSnap = await adminDb
      .collection('domains')
      .where('userId', '==', userId)
      .get();

    let currentCount = 0;
    domainsSnap.forEach((d: any) => {
      if (d.data().status !== 'removed') currentCount++;
    });

    if (currentCount >= plan.maxDomains) {
      return {
        allowed: false,
        reason: `Your current ${plan.name} plan limit is reached (${currentCount}/${plan.maxDomains} custom domains). Upgrade to Pro or Business to connect more domains.`,
        currentCount,
        maxLimit: plan.maxDomains,
        plan,
        requiresUpgrade: true,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxLimit: plan.maxDomains,
      plan,
    };
  }
}
