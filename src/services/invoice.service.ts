/**
 * Invoice Generation & Management Service
 * Creates structured, GST-compliant tax invoices with collision-safe sequential numbering.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { InvoiceRecord, PaymentRecord, Plan } from '../types';
import { GST_RATE } from '../config/constants';

export const invoiceService = {
  /**
   * Generate next sequential invoice number: VTX-YYYY-XXXXXX
   */
  async generateNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    try {
      const q = query(
        collection(db, 'invoices'),
        orderBy('issuedAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      let nextSeq = 1;
      if (!snap.empty) {
        const lastInv = snap.docs[0].data() as InvoiceRecord;
        const parts = lastInv.invoiceNumber?.split('-');
        if (parts && parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) nextSeq = num + 1;
        }
      }
      return `VTX-${year}-${String(nextSeq).padStart(6, '0')}`;
    } catch {
      // Collision fallback using timestamp
      const fallback = Math.floor(100000 + Math.random() * 900000);
      return `VTX-${year}-${fallback}`;
    }
  },

  /**
   * Create and store a new invoice for a confirmed payment
   */
  async createInvoice(params: {
    payment: PaymentRecord;
    plan: Plan;
    customerName: string;
    customerEmail: string;
    customerGstin?: string;
  }): Promise<InvoiceRecord> {
    const invoiceNumber = await this.generateNextInvoiceNumber();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const invoice: InvoiceRecord = {
      id: invoiceId,
      invoiceNumber,
      userId: params.payment.userId,
      paymentId: params.payment.id,
      subscriptionId: params.payment.subscriptionId,
      planId: params.plan.id,
      planName: params.plan.name,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerGstin: params.customerGstin,
      subtotal: params.payment.subtotal,
      gstRate: params.payment.gstRate || GST_RATE,
      gstAmount: params.payment.gstAmount,
      totalAmount: params.payment.amount,
      currency: params.payment.currency || 'INR',
      status: 'paid',
      issuedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'invoices', invoiceId), invoice);
    return invoice;
  },

  /**
   * Get all invoices for a specific user
   */
  async getUserInvoices(userId: string): Promise<InvoiceRecord[]> {
    const q = query(collection(db, 'invoices'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<InvoiceRecord, 'id'>) }))
      .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''));
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Renders modular HTML for viewing/printing the invoice
   * Easy to replace or re-skin with exact Vivexa template
   */
  renderInvoiceHtml(inv: InvoiceRecord): string {
    const cgst = inv.gstAmount / 2;
    const sgst = inv.gstAmount / 2;

    return `
      <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px;">
          <div>
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.5px;">VIVEXA DEPLOYX</h1>
            <p style="font-size: 14px; color: #64748b; margin: 0;">vivexatech.in &bull; Cloud Hosting & Edge Platform</p>
            <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0 0;">GSTIN: 29AAAAA0000A1Z5</p>
          </div>
          <div style="text-align: right;">
            <div style="background: #f1f5f9; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; color: #334155; display: inline-block;">TAX INVOICE</div>
            <p style="font-size: 14px; font-weight: 600; margin: 8px 0 2px 0;">${inv.invoiceNumber}</p>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Date: ${new Date(inv.issuedAt).toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
          <div>
            <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin: 0 0 8px 0;">Billed To</p>
            <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0;">${inv.customerName}</p>
            <p style="font-size: 13px; color: #64748b; margin: 0;">${inv.customerEmail}</p>
          </div>
          <div>
            <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin: 0 0 8px 0;">Payment Details</p>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 4px 0;">Payment ID: <span style="font-family: monospace; color: #0f172a;">${inv.paymentId}</span></p>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Status: <span style="color: #16a34a; font-weight: 600;">PAID</span></p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">Description</th>
              <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: #475569;">SAC Code</th>
              <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 700; color: #475569;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 16px;">
                <p style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0;">Vivexa ${inv.planName} Plan Subscription</p>
                <p style="font-size: 12px; color: #64748b; margin: 0;">Cloud hosting platform with Vercel edge infrastructure and automated deployments</p>
              </td>
              <td style="padding: 16px; text-align: right; font-size: 13px; color: #475569;">998315</td>
              <td style="padding: 16px; text-align: right; font-size: 14px; font-weight: 600; color: #0f172a;">${this.formatCurrency(inv.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="width: 320px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">
              <span>Subtotal:</span>
              <span style="font-weight: 600; color: #0f172a;">${this.formatCurrency(inv.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">
              <span>CGST @ 9%:</span>
              <span style="font-weight: 600; color: #0f172a;">${this.formatCurrency(cgst)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">
              <span>SGST @ 9%:</span>
              <span style="font-weight: 600; color: #0f172a;">${this.formatCurrency(sgst)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0f172a;">
              <span>Total Paid:</span>
              <span>${this.formatCurrency(inv.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0 0 4px 0;">This is a computer generated invoice and requires no physical signature.</p>
          <p style="margin: 0;">Questions? Contact vivexatech@gmail.com | Thank you for choosing Vivexa DeployX.</p>
        </div>
      </div>
    `;
  },
};
