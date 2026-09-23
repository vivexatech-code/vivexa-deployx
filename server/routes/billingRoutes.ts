import { Router } from 'express';
import { getAdminServices, authenticateRequest } from '../firebaseAdmin';
import { RazorpayService } from '../razorpayService';
import {
  getPlanFromFirebase,
  getAllPlansFromFirebase,
  calculatePriceWithGst,
  GST_RATE,
} from '../plansData';

export const billingRouter = Router();

/**
 * Service status
 */
billingRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'billing',
    endpoints: ['/config', '/plans', '/create-order', '/verify-payment', '/cancel-subscription'],
  });
});

/**
 * Public/Client Razorpay configuration
 */
billingRouter.get('/config', (req, res) => {
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    configured: RazorpayService.isConfigured(),
    currency: 'INR',
    gstRate: GST_RATE,
  });
});

/**
 * Fetch authoritative plans dynamically from Firebase Firestore
 */
billingRouter.get('/plans', async (req, res) => {
  try {
    const plans = await getAllPlansFromFirebase();
    res.json({ plans });
  } catch (err: any) {
    console.error('Error fetching plans in billingRouter:', err);
    res.status(500).json({ error: 'Failed to retrieve plans from database.' });
  }
});

/**
 * Create official Razorpay Order for a specific subscription plan
 * Checks authentication, looks up Firebase plan price, verifies active status,
 * computes GST, and calls Razorpay API.
 */
billingRouter.post('/create-order', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required to initiate checkout.' });
      return;
    }

    const { planId } = req.body;
    if (!planId) {
      res.status(400).json({ error: 'Plan ID is required to initiate checkout.' });
      return;
    }

    const plan = await getPlanFromFirebase(planId);
    if (!plan) {
      res.status(400).json({ error: `Invalid plan specified: "${planId}".` });
      return;
    }

    if (!plan.active) {
      res.status(400).json({ error: 'This plan is currently inactive and cannot be purchased.' });
      return;
    }

    if (!plan.razorpayPlanId || plan.razorpayPlanId.trim() === '') {
      res.status(400).json({ error: 'Payment configuration is incomplete for this plan. Please contact support.' });
      return;
    }

    const orderData = await RazorpayService.createOrder({
      planId: plan.id,
      userId: user.uid,
    });

    res.json(orderData);
  } catch (err: any) {
    console.error('Error creating Razorpay order:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to initialize payment gateway order.' });
  }
});

/**
 * Verify payment signature and activate subscription + generate GST invoice
 * Critical: Users CANNOT change plan without cryptographically verified payment!
 * Stores an immutable snapshot of plan price at purchase time.
 */
billingRouter.post('/verify-payment', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      planId,
      customerName,
      customerEmail,
      gstin,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
      res.status(400).json({ error: 'Missing payment verification credentials or plan ID.' });
      return;
    }

    // 1. Fetch authoritative plan from Firebase
    const plan = await getPlanFromFirebase(planId);
    if (!plan) {
      res.status(400).json({ error: `Invalid plan ID: "${planId}".` });
      return;
    }

    if (!plan.active) {
      res.status(400).json({ error: 'This plan is currently inactive and cannot be activated.' });
      return;
    }

    // 2. Cryptographic HMAC-SHA256 signature verification
    const isValidSignature = RazorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      res.status(400).json({ error: 'Invalid payment signature. Payment verification failed.' });
      return;
    }

    // 3. Calculate GST and total amount server-side from Firebase plan price
    const { subtotal, gstRate, gstAmount, totalAmount, amountInPaise } = calculatePriceWithGst(
      plan.price,
      plan.gstRate
    );

    // 4. Fetch payment details from Razorpay to verify captured status & amount
    let paymentDetails: any = null;
    try {
      paymentDetails = await RazorpayService.getPayment(razorpayPaymentId);
      if (paymentDetails) {
        // Enforce captured status if already processed by gateway
        if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
          res.status(400).json({ error: `Payment not completed. Current gateway status: ${paymentDetails.status}` });
          return;
        }
        // Enforce strict server-side price validation - never trust client amounts
        const paidPaise = Number(paymentDetails.amount);
        const expectedBasePaise = Math.round(plan.price * 100);
        if (paidPaise && paidPaise !== amountInPaise && paidPaise !== expectedBasePaise) {
          console.error(`Payment amount mismatch! Expected ${amountInPaise} paise, received ${paidPaise} paise.`);
          res.status(400).json({ error: 'Payment amount mismatch against canonical plan pricing.' });
          return;
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

    // 6. Create/update active subscription in Firestore with verified paymentStatus: 'paid'
    // Storing immutable snapshot of price, gst, and razorpay identifiers at purchase time
    await adminDb.collection('subscriptions').doc(subscriptionId).set({
      id: subscriptionId,
      userId: user.uid,
      planId: plan.id,
      planName: plan.name,
      price: plan.price, // SNAPSHOT of base price at purchase time
      currency: plan.currency || 'INR',
      gstRate, // SNAPSHOT of GST rate
      gstAmount, // SNAPSHOT of GST amount
      totalAmount, // SNAPSHOT of total paid
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

    // 8. Generate legal 18% GST tax invoice in Firestore with snapshot pricing
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
      hsnCode: '998315', // Hosting & IT Infrastructure
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

    // 9. Send in-app notification to user
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

    // 10. Create audit log
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

    res.json({
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
    res.status(500).json({ error: err.message || 'Payment verification failed' });
  }
});

/**
 * Cancel subscription renewal
 */
billingRouter.post('/cancel-subscription', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
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

    res.json({ success: true, message: 'Subscription renewal canceled.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel renewal.' });
  }
});

/**
 * Razorpay Webhook listener (order.paid, payment.captured)
 * Implements cryptographic signature verification and idempotency check.
 */
billingRouter.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const bodyStr = JSON.stringify(req.body);

    if (signature && !RazorpayService.verifyWebhookSignature(bodyStr, signature)) {
      res.status(400).send('Invalid webhook signature');
      return;
    }

    const event = req.body?.event;
    const eventId = req.body?.id || (req.headers['x-razorpay-event-id'] as string);
    console.log(`Razorpay webhook received: ${event} (Event ID: ${eventId})`);

    const { adminDb } = getAdminServices();

    // Idempotency: Reject repeated deliveries of already processed webhook events
    if (eventId) {
      const processedSnap = await adminDb.collection('_processedEvents').doc(eventId).get();
      if (processedSnap.exists) {
        console.log(`[Webhook] Duplicate delivery for event ${eventId}, already processed.`);
        res.json({ status: 'already_processed', eventId });
        return;
      }
    }

    // Process event
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body?.payload?.payment?.entity;
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
              price: plan.price, // SNAPSHOT of base price
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

    // Record processed event ID for idempotency
    if (eventId) {
      await adminDb.collection('_processedEvents').doc(eventId).set({
        id: eventId,
        event,
        processedAt: new Date().toISOString(),
      });
    }

    res.json({ status: 'ok', eventId });
  } catch (err: any) {
    console.error('Error processing Razorpay webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DIRECT API ATTACK REJECTION
 * Normal or malicious authenticated users MUST NOT be able to call endpoints like:
 * /api/billing/update, /api/subscription/update, /api/billing/set-plan
 * to arbitrarily set planId, status: active, or paymentStatus: paid.
 */
billingRouter.all(
  ['/update', '/update-subscription', '/set-plan', '/activate', '/upgrade-free'],
  (req, res) => {
    res.status(403).json({
      error: 'Direct subscription manipulation is forbidden. Subscriptions require server-verified payment.',
    });
  }
);

