/**
 * Server-side Razorpay Service
 * Handles authentic order generation, webhook signature validation, and payment verification.
 */

import crypto from 'crypto';
import { getPlanFromFirebase, calculatePriceWithGst, FirebasePlan } from './plansData';

export class RazorpayService {
  private static getKeyId(): string {
    return process.env.RAZORPAY_KEY_ID || '';
  }

  private static getKeySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET || '';
  }

  public static isConfigured(): boolean {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    return Boolean(keyId && keySecret && keyId.length > 5 && keySecret.length > 5);
  }

  private static getBasicAuthHeader(): string {
    const credentials = `${this.getKeyId()}:${this.getKeySecret()}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Fetch plan details directly from Razorpay Plan API
   */
  public static async getPlan(planId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials are not configured on the server.');
    }

    const res = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, {
      headers: {
        Authorization: this.getBasicAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error?.description || `Razorpay plan ${planId} lookup failed (${res.status})`);
      error.status = res.status;
      throw error;
    }

    return await res.json();
  }

  /**
   * Create an official order on Razorpay based strictly on authoritative Firebase plan pricing.
   */
  public static async createOrder(params: {
    planId: string;
    userId: string;
    receipt?: string;
  }): Promise<{
    orderId: string;
    amount: number; // in paise
    currency: string;
    keyId: string;
    subtotal: number;
    gstRate: number;
    gstAmount: number;
    totalAmount: number;
    planName: string;
    razorpayPlanId?: string;
  }> {
    // 1. Fetch authoritative plan details from Firebase
    const plan = await getPlanFromFirebase(params.planId);
    if (!plan) {
      throw new Error(`Plan "${params.planId}" not found in Firebase configuration.`);
    }

    // 2. Reject inactive plan purchases
    if (!plan.active) {
      throw new Error('This plan is currently inactive and cannot be purchased.');
    }

    // 3. Enforce Razorpay Plan ID presence
    if (!plan.razorpayPlanId || plan.razorpayPlanId.trim() === '') {
      throw new Error('Payment configuration is incomplete for this plan. Please contact support.');
    }

    // 4. Calculate prices & GST server-side
    const { subtotal, gstRate, gstAmount, totalAmount, amountInPaise } = calculatePriceWithGst(
      plan.price,
      plan.gstRate
    );

    const keyId = this.getKeyId();
    const receipt = params.receipt || `rcpt_${params.userId.substring(0, 8)}_${Date.now()}`;

    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured on the server.');
    }

    // 5. Cross-verify price with Razorpay Plan API where available
    try {
      const rzpPlan = await this.getPlan(plan.razorpayPlanId);
      if (rzpPlan && rzpPlan.item) {
        const rzpAmountInPaise = Number(rzpPlan.item.amount);
        const expectedBasePaise = Math.round(plan.price * 100);
        const expectedTotalPaise = amountInPaise;

        // Razorpay plan item amount must match either base price or total with GST
        if (
          rzpAmountInPaise > 0 &&
          rzpAmountInPaise !== expectedBasePaise &&
          rzpAmountInPaise !== expectedTotalPaise
        ) {
          throw new Error(
            `Configuration error: Plan price mismatch. Firebase plan price is ₹${plan.price}, but Razorpay plan "${plan.razorpayPlanId}" is set to ₹${(rzpAmountInPaise / 100).toFixed(2)}. Payment cannot proceed. Admin must fix the configuration.`
          );
        }
      }
    } catch (err: any) {
      if (err.message && err.message.startsWith('Configuration error:')) {
        throw err;
      }
      if (
        err.status === 400 ||
        err.status === 404 ||
        err.message?.toLowerCase().includes('not found') ||
        err.message?.toLowerCase().includes('bad request')
      ) {
        throw new Error('Payment configuration is incomplete for this plan. Please contact support.');
      }
      console.warn(`[Razorpay Plan Verification] Non-fatal check warning for ${plan.razorpayPlanId}:`, err.message);
    }

    // 6. Create Razorpay order
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: plan.currency || 'INR',
        receipt,
        notes: {
          planId: plan.id,
          planName: plan.name,
          userId: params.userId,
          basePrice: subtotal,
          gstRate: `${gstRate}%`,
          gstAmount,
          totalAmount,
          razorpayPlanId: plan.razorpayPlanId,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error?.description || `Razorpay order creation failed with status ${res.status}`);
    }

    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency || 'INR',
      keyId,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      planName: plan.name,
      razorpayPlanId: plan.razorpayPlanId,
    };
  }

  /**
   * Cryptographically verify payment signature
   * signature = HMAC-SHA256(order_id + "|" + razorpay_payment_id, secret)
   */
  public static verifyPaymentSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const secret = this.getKeySecret();
    if (!secret) return false;

    const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return expectedSignature === params.razorpaySignature;
  }

  /**
   * Fetch payment details directly from Razorpay
   */
  public static async getPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay is not configured.');
    }

    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: this.getBasicAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.description || `Failed to fetch Razorpay payment ${paymentId}`);
    }

    return await res.json();
  }

  /**
   * Verify Razorpay webhook signature
   */
  public static verifyWebhookSignature(payload: string, signature: string, webhookSecret?: string): boolean {
    const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || this.getKeySecret();
    if (!secret) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }
}
