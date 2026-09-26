import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { RazorpayService } from '@/lib/razorpay/razorpayService';
import { getPlanFromFirebase, calculatePriceWithGst } from '@/lib/plans/plansData';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      planId,
      customerName,
      customerEmail,
      gstin,
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
      return NextResponse.json(
        { error: 'Missing payment verification credentials or plan ID.' },
        { status: 400 }
      );
    }

    // 1. Fetch authoritative plan from Firebase
    const plan = await getPlanFromFirebase(planId);
    if (!plan) {
      return NextResponse.json({ error: `Invalid plan ID: "${planId}".` }, { status: 400 });
    }

    if (!plan.active) {
      return NextResponse.json({ error: 'This plan is currently inactive and cannot be activated.' }, { status: 400 });
    }

    // 2. Cryptographic HMAC-SHA256 signature verification
    const isValidSignature = RazorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid payment signature. Payment verification failed.' }, { status: 400 });
    }

    // 3. Calculate GST and total amount server-side from Firebase plan price
    const { subtotal, gstRate, gstAmount, totalAmount, amountInPaise } = calculatePriceWithGst(
      plan.price,
      plan.gstRate
    );

    // 4. Fetch payment details from Razorpay to verify captured status & amount
    let paymentDetails: any = null;
    try {
      paymentDetails = await RazorpayService.fetchPayment(razorpayPaymentId);
      if (paymentDetails) {
        if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
          return NextResponse.json(
            { error: `Payment not completed. Current gateway status: ${paymentDetails.status}` },
            { status: 400 }
          );
        }
        const paidPaise = Number(paymentDetails.amount);
        const expectedBasePaise = Math.round(plan.price * 100);
        if (paidPaise && paidPaise !== amountInPaise && paidPaise !== expectedBasePaise) {
          console.error(`Payment amount mismatch! Expected ${amountInPaise} paise, received ${paidPaise} paise.`);
          return NextResponse.json(
            { error: 'Payment amount mismatch against canonical plan pricing.' },
            { status: 400 }
          );
        }
      }
    } catch (e: any) {
      console.warn('Could not fetch payment from Razorpay API:', e.message);
    }

    const { adminDb } = getAdminServices();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invoiceId = `inv_${Date.now()}`;
    const invoiceNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentRecordId = `pay_${Date.now()}`;
    const subscriptionId = `sub_${user.uid}`;

    // 5. Update user profile in Firestore
    await adminDb.collection('users').doc(user.uid).set(
      {
        planId: plan.id,
        plan: plan.id,
        subscriptionStatus: 'active',
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );

    // 6. Create/update active subscription in Firestore
    await adminDb.collection('subscriptions').doc(subscriptionId).set({
      id: subscriptionId,
      userId: user.uid,
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
      razorpayOrderId,
      razorpayPaymentId,
      startedAt: now.toISOString(),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // 7. Store verified payment record in Firestore
    await adminDb.collection('payments').doc(paymentRecordId).set({
      id: paymentRecordId,
      userId: user.uid,
      subscriptionId,
      planId: plan.id,
      planName: plan.name,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount: totalAmount,
      subtotal,
      gstRate,
      gstAmount,
      currency: plan.currency || 'INR',
      status: 'captured',
      paymentMethod: paymentDetails?.method || 'razorpay',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // 8. Generate tax invoice in Firestore
    const userGstin = (gstin || '').trim().toUpperCase();
    const isKarnataka = userGstin.startsWith('29');

    await adminDb.collection('invoices').doc(invoiceId).set({
      id: invoiceId,
      invoiceNumber,
      userId: user.uid,
      subscriptionId,
      paymentId: paymentRecordId,
      planId: plan.id,
      planName: plan.name,
      customerName: customerName || user.email || 'Customer',
      customerEmail: customerEmail || user.email || '',
      customerGstin: userGstin || 'URP',
      companyName: 'Vivexa Technologies Pvt Ltd',
      companyGstin: '29AAAAA0000A1Z5',
      companyAddress: 'Tech Park, Bangalore, Karnataka - 560100',
      hsnCode: '998315',
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      currency: plan.currency || 'INR',
      taxBreakdown: isKarnataka
        ? {
            cgstRate: gstRate / 2 / 100,
            cgstAmount: Number((subtotal * (gstRate / 2 / 100)).toFixed(2)),
            sgstRate: gstRate / 2 / 100,
            sgstAmount: Number((subtotal * (gstRate / 2 / 100)).toFixed(2)),
            igstRate: 0,
            igstAmount: 0,
          }
        : {
            cgstRate: 0,
            cgstAmount: 0,
            sgstRate: 0,
            sgstAmount: 0,
            igstRate: gstRate / 100,
            igstAmount: gstAmount,
          },
      status: 'paid',
      issuedAt: now.toISOString(),
      paidAt: now.toISOString(),
    });

    // 9. Send in-app notification
    const notifId = `notif_${Date.now()}`;
    await adminDb.collection('notifications').doc(notifId).set({
      id: notifId,
      userId: user.uid,
      title: 'Plan Activated! 🎉',
      message: `Your account has been upgraded to ${plan.name}. Tax invoice ${invoiceNumber} is available.`,
      type: 'success',
      link: '/dashboard/billing',
      read: false,
      createdAt: now.toISOString(),
    });

    // 10. Audit log
    const auditId = `audit_${Date.now()}`;
    await adminDb.collection('auditLogs').doc(auditId).set({
      id: auditId,
      userId: user.uid,
      userEmail: user.email,
      action: 'PAYMENT_VERIFIED',
      details: {
        planId: plan.id,
        invoiceNumber,
        razorpayPaymentId,
        amount: totalAmount,
        price: plan.price,
      },
      createdAt: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Plan upgraded to ${plan.name} successfully!`,
      planId: plan.id,
      invoiceId,
      invoiceNumber,
      totalAmount,
      currency: plan.currency || 'INR',
    });
  } catch (err: any) {
    console.error('Error verifying Razorpay payment:', err);
    return NextResponse.json({ error: err.message || 'Payment verification failed' }, { status: 500 });
  }
}
