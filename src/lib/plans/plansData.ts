import { getAdminServices, isAdminConfigured } from '../firebase/admin';

export interface FirebasePlan {
  id: string;
  name: string;
  price: number; // Authoritative base price from Firebase
  currency: string;
  gstRate: number; // Rate configured in Firebase (e.g. 18 or 0.18)
  razorpayPlanId?: string;
  active: boolean;
  maxProjects: number;
  maxDomains: number;
  maxSubdomains: number;
  maxDeployments: number;
  features: string[];
  description?: string;
  highlight?: boolean;
}

export const GST_RATE = 0.18; // Default fallback if not configured on plan

/**
 * Calculates GST and total amount server-side.
 * Never trust client amounts.
 * Internally produces integer paise for payment gateways.
 */
export function calculatePriceWithGst(basePrice: number, rawGstRate?: number) {
  const configuredRate = rawGstRate !== undefined ? Number(rawGstRate) : 18;
  const rateMultiplier = configuredRate > 1 ? configuredRate / 100 : configuredRate;
  
  const subtotal = Number(basePrice.toFixed(2));
  const gstAmount = Number((subtotal * rateMultiplier).toFixed(2));
  const totalAmount = Number((subtotal + gstAmount).toFixed(2));
  const amountInPaise = Math.round(totalAmount * 100);

  return {
    subtotal,
    gstRate: configuredRate,
    gstRateMultiplier: rateMultiplier,
    gstAmount,
    totalAmount,
    amountInPaise,
  };
}

/**
 * Normalizes Firestore plan document into a strongly typed FirebasePlan.
 */
function normalizePlanDoc(id: string, data: any): FirebasePlan {
  const rawGst = data.gstRate !== undefined ? Number(data.gstRate) : 18;
  return {
    id,
    name: data.name || id,
    price: Number(data.price ?? 0),
    currency: data.currency || 'INR',
    gstRate: rawGst,
    razorpayPlanId: data.razorpayPlanId || '',
    active: data.active !== false,
    maxProjects: Number(data.maxProjects ?? 3),
    maxDomains: Number(data.maxDomains ?? 1),
    maxSubdomains: Number(data.maxSubdomains ?? 0),
    maxDeployments: Number(data.maxDeployments ?? 100),
    features: Array.isArray(data.features) ? data.features : [],
    description: data.description || '',
    highlight: Boolean(data.highlight),
  };
}

/**
 * Resolve plan aliases (e.g., 'starter' vs 'plan_starter')
 */
function getAliasCandidates(planId: string): string[] {
  const clean = planId.trim();
  const lower = clean.toLowerCase();
  const candidates: string[] = [clean];

  if (lower.startsWith('plan_')) {
    candidates.push(lower.replace(/^plan_/, ''));
  } else {
    candidates.push(`plan_${lower}`);
  }

  return Array.from(new Set(candidates));
}

/**
 * Authoritatively retrieves a plan directly from Firestore `plans` collection.
 */
export async function getPlanFromFirebase(planId: string): Promise<FirebasePlan | null> {
  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local.'
    );
  }
  const { adminDb } = getAdminServices();
  const candidates = getAliasCandidates(planId);

  // Try direct lookups for each alias candidate
  for (const candidate of candidates) {
    try {
      const docSnap = await adminDb.collection('plans').doc(candidate).get();
      if (docSnap.exists) {
        return normalizePlanDoc(docSnap.id, docSnap.data());
      }
    } catch (err: any) {
      console.warn(`[getPlanFromFirebase] Firestore lookup error for doc "${candidate}":`, err.message);
    }
  }

  // Fallback: Query all plans and match by id or name
  try {
    const snap = await adminDb.collection('plans').get();
    for (const doc of snap.docs) {
      const docId = doc.id.toLowerCase();
      const docName = (doc.data()?.name || '').toLowerCase();
      for (const candidate of candidates) {
        const cLower = candidate.toLowerCase();
        if (docId === cLower || docName === cLower) {
          return normalizePlanDoc(doc.id, doc.data());
        }
      }
    }
  } catch (err: any) {
    console.error('[getPlanFromFirebase] Query error:', err.message);
  }

  return null;
}

/**
 * Authoritatively retrieves all active plans directly from Firestore `plans` collection.
 */
export async function getAllPlansFromFirebase(): Promise<FirebasePlan[]> {
  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local.'
    );
  }
  const { adminDb } = getAdminServices();
  const snap = await adminDb.collection('plans').get();
  const plans: FirebasePlan[] = [];
  const seenNames = new Set<string>();

  for (const doc of snap.docs) {
    const plan = normalizePlanDoc(doc.id, doc.data());
    const lowerName = plan.name.toLowerCase();
    if (!seenNames.has(lowerName)) {
      seenNames.add(lowerName);
      plans.push(plan);
    }
  }

  // Sort by price ascending
  return plans.sort((a, b) => a.price - b.price);
}
