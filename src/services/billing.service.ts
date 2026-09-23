/**
 * Billing & Razorpay Payment Service
 * Integrates with server-side Razorpay order generation, HMAC cryptographic signature verification,
 * 18% GST compliance, and server-side subscription entitlement updates.
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { GST_RATE } from '../config/constants';
import { fetchApi } from './apiClient';
import { PaymentRecord, Subscription, UserProfile, InvoiceRecord } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const billingService = {
  /**
   * Fetch server Razorpay status
   */
  async getConfig(): Promise<{ keyId: string; configured: boolean; gstRate: number }> {
    try {
      return await fetchApi('/api/billing/config');
    } catch {
      return { keyId: '', configured: false, gstRate: GST_RATE };
    }
  },

  /**
   * Calculate 18% GST itemized totals
   */
  calculateTotals(basePrice: number) {
    const subtotal = basePrice;
    const gstAmount = Number((subtotal * GST_RATE).toFixed(2));
    const totalAmount = Number((subtotal + gstAmount).toFixed(2));
    return { subtotal, gstAmount, totalAmount, gstRate: GST_RATE };
  },

  /**
   * Create an authentic Razorpay Order and trigger the checkout modal.
   * All prices and GST are computed securely on the server.
   */
  async createCheckoutSession(params: {
    planId: string;
    userId: string;
    userProfile: UserProfile;
    onSuccess: (result: any) => void;
    onFailure: (error: any) => void;
  }) {
    // 1. Create order on the server
    const orderData = await fetchApi('/api/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({
        planId: params.planId,
      }),
    });

    // 2. Ensure Razorpay checkout script is loaded
    if (typeof window !== 'undefined' && !window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
        document.body.appendChild(script);
      });
    }

    // 3. Launch Razorpay payment modal
    const options = {
      key: orderData.keyId,
      amount: orderData.amount, // in paise
      currency: orderData.currency || 'INR',
      name: 'Vivexa Hosting',
      description: `${orderData.planName} Plan (includes 18% GST)`,
      image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2601.png',
      order_id: orderData.orderId,
      prefill: {
        name: params.userProfile.name || '',
        email: params.userProfile.email || '',
      },
      notes: {
        planId: params.planId,
        userId: params.userId,
      },
      theme: {
        color: '#0f172a',
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          // 4. Verify signature on backend & activate subscription
          const verificationResult = await fetchApi('/api/billing/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id || orderData.orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planId: params.planId,
              customerName: params.userProfile.name,
              customerEmail: params.userProfile.email,
              gstin: params.userProfile.gstin,
            }),
          });

          params.onSuccess(verificationResult);
        } catch (err) {
          params.onFailure(err);
        }
      },
      modal: {
        ondismiss: () => {
          params.onFailure(new Error('Payment was canceled or closed without completion.'));
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  },

  /**
   * Cancel subscription renewal at period end via backend
   */
  async cancelSubscription(userId: string): Promise<void> {
    await fetchApi('/api/billing/cancel-subscription', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  /**
   * Get user payment history from Firestore
   */
  async getUserPayments(userId: string): Promise<PaymentRecord[]> {
    try {
      const q = query(
        collection(db, 'payments'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }));
    } catch (err) {
      console.warn('Error getting payments:', err);
      return [];
    }
  },

  /**
   * Get user invoices from Firestore
   */
  async getUserInvoices(userId: string): Promise<InvoiceRecord[]> {
    try {
      const q = query(
        collection(db, 'invoices'),
        where('userId', '==', userId),
        orderBy('issuedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (err) {
      console.warn('Error getting invoices:', err);
      return [];
    }
  },
};
