/**
 * Server-side Razorpay Service
 * Handles authentic order generation, webhook signature validation, and payment verification.
 */

import crypto from 'crypto';
import { getPlanFromFirebase, calculatePriceWithGst, FirebasePlan } from '../plans/plansData';

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
    amount: number;
    amountInPaise: number;
    currency: string;
    keyId: string;
    plan: FirebasePlan;
    gstDetails: {
      subtotal: number;
      gstRate: number;
      gstAmount: number;
      totalAmount: number;
    };
  }> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
    }

    // 1. Fetch authoritative plan directly from Firebase
    const plan = await getPlanFromFirebase(params.planId);
    if (!plan) {
      throw new Error(`Plan "${params.planId}" does not exist in Firebase plans collection.`);
    }

    if (plan.active === false) {
      throw new Error(`Plan "${plan.name}" is currently inactive and unavailable for checkout.`);
    }

    // 2. Validate against Razorpay Plan API if razorpayPlanId is specified
    if (plan.razorpayPlanId) {
      try {
        const rzPlan = await this.getPlan(plan.razorpayPlanId);
        if (rzPlan && rzPlan.item) {
          const rzAmountInPaise = rzPlan.item.amount;
          const expectedBaseInPaise = Math.round(plan.price * 100);
          if (rzAmountInPaise !== expectedBaseInPaise) {
            console.error(
              `[Razorpay Mismatch] Firebase price is ₹${plan.price} (${expectedBaseInPaise} paise) but Razorpay plan ${plan.razorpayPlanId} is ${rzAmountInPaise} paise.`
            );
            throw new Error(
              `Plan price mismatch: Firebase price (₹${plan.price}) does not match Razorpay plan price (₹${rzAmountInPaise / 100}). Admin must reconcile configuration.`
            );
          }
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes('mismatch')) {
          throw checkErr;
        }
        console.warn(`[Razorpay Plan Validation Warning] Could not verify plan ${plan.razorpayPlanId}:`, checkErr.message);
      }
    }

    // 3. Compute price with GST server-side
    const gstCalc = calculatePriceWithGst(plan.price, plan.gstRate);
    const receipt = params.receipt || `rcpt_${params.userId.slice(0, 6)}_${Date.now()}`;

    // 4. Create authentic Razorpay order
    const payload = {
      amount: gstCalc.amountInPaise,
      currency: plan.currency || 'INR',
      receipt,
      notes: {
        userId: params.userId,
        planId: plan.id,
        planName: plan.name,
        basePrice: String(gstCalc.subtotal),
        gstRate: String(gstCalc.gstRate),
        gstAmount: String(gstCalc.gstAmount),
        totalAmount: String(gstCalc.totalAmount),
      },
    };

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.description || `Failed to create Razorpay order: HTTP ${res.status}`);
    }

    const order = await res.json();

    return {
      orderId: order.id,
      amount: gstCalc.totalAmount,
      amountInPaise: gstCalc.amountInPaise,
      currency: order.currency,
      keyId: this.getKeyId(),
      plan,
      gstDetails: {
        subtotal: gstCalc.subtotal,
        gstRate: gstCalc.gstRate,
        gstAmount: gstCalc.gstAmount,
        totalAmount: gstCalc.totalAmount,
      },
    };
  }

  /**
   * Verify Razorpay payment signature
   */
  public static verifyPaymentSignature(params: {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }): boolean {
    const secret = this.getKeySecret();
    if (!secret) return false;

    const orderId = params.orderId || params.razorpayOrderId;
    const paymentId = params.paymentId || params.razorpayPaymentId;
    const signature = params.signature || params.razorpaySignature;

    if (!orderId || !paymentId || !signature) return false;

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  }

  /**
   * Verify Razorpay webhook signature
   */
  public static verifyWebhookSignature(body: string, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || this.getKeySecret();
    if (!webhookSecret || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetch payment details directly from Razorpay
   */
  public static async fetchPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: this.getBasicAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Razorpay payment fetch failed with status ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Fetch order details directly from Razorpay
   */
  public static async fetchOrder(orderId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: this.getBasicAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Razorpay order fetch failed with status ${res.status}`);
    }

    return await res.json();
  }
}
