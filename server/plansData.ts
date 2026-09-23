import { getAdminServices } from './firebaseAdmin';

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
 * Authoritative Plan Resolver: Fetches plan dynamically from Firebase Firestore.
 * Supports direct ID, alias resolution (e.g., 'starter' <-> 'plan_starter'), and name matching.
 */
export async function getPlanFromFirebase(planId: string): Promise<FirebasePlan | null> {
  if (!planId) return null;
  const { adminDb } = getAdminServices();
  const cleanId = planId.trim();

  try {
    // 1. Direct document ID lookup
    let docSnap = await adminDb.collection('plans').doc(cleanId).get();

    // 2. Try alternate ID with/without 'plan_' prefix
    if (!docSnap.exists) {
      const alternateId = cleanId.startsWith('plan_')
        ? cleanId.replace('plan_', '')
        : `plan_${cleanId}`;
      docSnap = await adminDb.collection('plans').doc(alternateId).get();
    }

    // 3. Fallback to searching by case-insensitive name
    if (!docSnap.exists) {
      const qSnap = await adminDb.collection('plans').get();
      const match = qSnap.docs.find(
        (d: any) =>
          d.id.toLowerCase() === cleanId.toLowerCase() ||
          (d.data().name && d.data().name.toLowerCase() === cleanId.toLowerCase())
      );
      if (match) {
        docSnap = match;
      }
    }

    if (!docSnap.exists) {
      return null;
    }

    return normalizePlanDoc(docSnap.id, docSnap.data());
  } catch (err) {
    console.error(`[FirebasePlanService] Error fetching plan "${cleanId}":`, err);
    return null;
  }
}

/**
 * Fetches all unique plans dynamically configured in Firebase Firestore.
 */
export async function getAllPlansFromFirebase(): Promise<FirebasePlan[]> {
  const { adminDb } = getAdminServices();
  try {
    const snap = await adminDb.collection('plans').get();
    const seen = new Set<string>();
    const plans: FirebasePlan[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const nameKey = (data.name || doc.id).toLowerCase();
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);

      plans.push(normalizePlanDoc(doc.id, data));
    }

    return plans.sort((a, b) => a.price - b.price);
  } catch (err) {
    console.error('[FirebasePlanService] Error fetching all plans:', err);
    return [];
  }
}

