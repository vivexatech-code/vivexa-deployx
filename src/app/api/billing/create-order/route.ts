import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/firebase/admin';
import { RazorpayService } from '@/lib/razorpay/razorpayService';
import { getPlanFromFirebase } from '@/lib/plans/plansData';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required to initiate checkout.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required to initiate checkout.' }, { status: 400 });
    }

    const plan = await getPlanFromFirebase(planId);
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
    return NextResponse.json(
      { error: err.message || 'Failed to initialize payment gateway order.' },
      { status: err.status || 500 }
    );
  }
}
