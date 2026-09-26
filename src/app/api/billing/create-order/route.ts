import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAdminConfigured } from '@/lib/firebase/admin';
import { RazorpayService } from '@/lib/razorpay/razorpayService';
import { getPlanFromFirebase } from '@/lib/plans/plansData';

export async function POST(req: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            'Payment server is not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in Vercel.',
        },
        { status: 503 }
      );
    }

    if (!RazorpayService.isConfigured()) {
      return NextResponse.json(
        {
          error:
            'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel environment variables.',
        },
        { status: 503 }
      );
    }

    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to initiate checkout. Please sign in again.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required to initiate checkout.' }, { status: 400 });
    }

    let plan;
    try {
      plan = await getPlanFromFirebase(planId);
    } catch (planErr: any) {
      console.error('Plan lookup failed:', planErr);
      return NextResponse.json(
        {
          error:
            planErr.message ||
            'Could not load plans from Firestore. Confirm FIRESTORE_DATABASE_ID and Firebase Admin credentials on Vercel.',
        },
        { status: 503 }
      );
    }

    if (!plan) {
      return NextResponse.json({ error: `Invalid plan specified: "${planId}".` }, { status: 400 });
    }

    if (!plan.active) {
      return NextResponse.json({ error: 'This plan is currently inactive and cannot be purchased.' }, { status: 400 });
    }

    if (!plan.razorpayPlanId || plan.razorpayPlanId.trim() === '') {
      return NextResponse.json(
        { error: 'Payment configuration is incomplete for this plan. Please contact support.' },
        { status: 400 }
      );
    }

    const orderData = await RazorpayService.createOrder({
      planId: plan.id,
      userId: user.uid,
    });

    return NextResponse.json(orderData);
  } catch (err: any) {
    console.error('Error creating Razorpay order:', err);
    const status = typeof err.status === 'number' ? err.status : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to initialize payment gateway order.' },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
