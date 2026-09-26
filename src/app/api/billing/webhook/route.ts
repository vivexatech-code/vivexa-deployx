import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase/admin';
import { RazorpayService } from '@/lib/razorpay/razorpayService';
import { getPlanFromFirebase, calculatePriceWithGst } from '@/lib/plans/plansData';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    if (signature && !RazorpayService.verifyWebhookSignature(rawBody, signature)) {
      return new NextResponse('Invalid webhook signature', { status: 400 });
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new NextResponse('Invalid JSON body', { status: 400 });
    }

    const event = body?.event;
    const eventId = body?.id || req.headers.get('x-razorpay-event-id');
    console.log(`Razorpay webhook received: ${event} (Event ID: ${eventId})`);

    const { adminDb } = getAdminServices();

    if (eventId) {
      const processedSnap = await adminDb.collection('_processedEvents').doc(eventId).get();
      if (processedSnap.exists) {
        console.log(`[Webhook] Duplicate delivery for event ${eventId}, already processed.`);
        return NextResponse.json({ status: 'already_processed', eventId });
      }
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = body?.payload?.payment?.entity;
      const notes = paymentEntity?.notes || {};
      const planId = notes.planId;
      const userId = notes.userId;

      if (planId && userId) {
        const plan = await getPlanFromFirebase(planId);
        if (plan) {
          const subscriptionId = `sub_${userId}`;
          const now = new Date();
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const { subtotal, gstRate, gstAmount, totalAmount } = calculatePriceWithGst(
            plan.price,
            plan.gstRate
          );

          await adminDb.collection('subscriptions').doc(subscriptionId).set(
            {
              id: subscriptionId,
              userId,
              planId: plan.id,
              planName: plan.name,
              price: plan.price,
              currency: plan.currency || 'INR',
              gstRate,
              gstAmount,
              totalAmount,
              status: 'active',
              paymentStatus: 'paid',
              amount: totalAmount,
              provider: 'razorpay',
              razorpayPlanId: plan.razorpayPlanId || '',
              razorpayPaymentId: paymentEntity.id,
              razorpayOrderId: paymentEntity.order_id,
              startedAt: now.toISOString(),
              currentPeriodStart: now.toISOString(),
              currentPeriodEnd: periodEnd.toISOString(),
              updatedAt: now.toISOString(),
            },
            { merge: true }
          );

          await adminDb.collection('users').doc(userId).set(
            {
              planId: plan.id,
              subscriptionStatus: 'active',
              updatedAt: now.toISOString(),
            },
            { merge: true }
          );
        }
      }
    }

    if (eventId) {
      await adminDb.collection('_processedEvents').doc(eventId).set({
        id: eventId,
        event,
        processedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: 'ok', eventId });
  } catch (err: any) {
    console.error('Error processing Razorpay webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
