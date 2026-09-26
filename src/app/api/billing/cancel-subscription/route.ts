import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { adminDb } = getAdminServices();
    const subscriptionId = `sub_${user.uid}`;
    const subDoc = await adminDb.collection('subscriptions').doc(subscriptionId).get();

    if (subDoc.exists) {
      await adminDb.collection('subscriptions').doc(subscriptionId).update({
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: 'Subscription renewal canceled.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to cancel renewal.' }, { status: 500 });
  }
}
