'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { planService } from '../../services/plan.service';
import { billingService } from '../../services/billing.service';
import { invoiceService } from '../../services/invoice.service';
import { authService } from '../../services/auth.service';
import { Plan, Subscription, PaymentRecord, InvoiceRecord } from '../../types';
import {
  CreditCard,
  CheckCircle2,
  FileText,
  Printer,
  X,
  ShieldCheck,
  Building,
  Clock,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

export const BillingView: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // GSTIN form
  const [gstin, setGstin] = useState(profile?.gstin || '');
  const [savingGst, setSavingGst] = useState(false);
  const [gstSavedMsg, setGstSavedMsg] = useState(false);

  // Invoice modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBillingData = async () => {
    if (!user) return;
    try {
      const [plansList, usage, payList, invList] = await Promise.all([
        planService.getPlans(),
        planService.getUserUsage(user.uid),
        billingService.getUserPayments(user.uid),
        invoiceService.getUserInvoices(user.uid),
      ]);
      setPlans(plansList);
      setCurrentPlan(usage.currentPlan);
      setSubscription(usage.subscription);
      setPayments(payList);
      setInvoices(invList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [user]);

  const handleUpdateGstin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingGst(true);
    try {
      await authService.updateProfileData(user.uid, { gstin: gstin.trim().toUpperCase() });
      await refreshProfile();
      setGstSavedMsg(true);
      setTimeout(() => setGstSavedMsg(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update GSTIN');
    } finally {
      setSavingGst(false);
    }
  };

  const handleUpgradePlan = async (plan: Plan) => {
    if (!user) return;
    setLoadingPlanId(plan.id);
    setErrorMsg(null);

    try {
      await billingService.createCheckoutSession({
        planId: plan.id,
        userId: user.uid,
        userProfile: profile || {
          uid: user.uid,
          name: user.displayName || 'Customer',
          email: user.email || '',
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        onSuccess: async () => {
          setLoadingPlanId(null);
          await loadBillingData();
        },
        onFailure: (err) => {
          setLoadingPlanId(null);
          setErrorMsg(err.message || 'Payment was not completed');
        },
      });
    } catch (err: any) {
      setLoadingPlanId(null);
      setErrorMsg(err.message || 'Failed to initiate checkout');
    }
  };

  const handleCancelSub = async () => {
    if (!user || !subscription) return;
    if (!confirm('Are you sure you want to cancel your plan renewal? Your subscription will remain active until the end of the current billing cycle.')) return;
    try {
      await billingService.cancelSubscription(user.uid);
      await loadBillingData();
      alert('Subscription set to cancel at end of current period.');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Billing & GST Invoices
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your subscription plans, Razorpay payment methods, GST details, and download tax invoices.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Subscription Status
            </span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {subscription?.status === 'active' && currentPlan
                  ? `${currentPlan.name} Plan`
                  : 'No Active Subscription'}
              </h2>
              {subscription?.status === 'active' && currentPlan ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                  Inactive &bull; Payment Required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {subscription?.status === 'active' && currentPlan ? (
                <>
                  ₹{currentPlan.price} / month + 18% GST &bull; Renews on{' '}
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN')
                    : 'Next monthly billing cycle'}
                </>
              ) : (
                'Select and activate any plan below using secure Razorpay checkout to start deploying.'
              )}
            </p>
          </div>

          {subscription?.status === 'active' && (
            subscription?.cancelAtPeriodEnd ? (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Cancels at end of billing cycle
              </span>
            ) : (
              <button
                onClick={handleCancelSub}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 underline cursor-pointer"
              >
                Cancel renewal
              </button>
            )
          )}
        </div>

        {/* GSTIN / Business Information */}
        <div className="pt-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-600" />
            Company GSTIN for Input Tax Credit
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Provide your 15-digit GSTIN to ensure it is printed on all your Vivexa tax invoices.
          </p>

          <form onSubmit={handleUpdateGstin} className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <input
              id="input-billing-gstin"
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="29AAAAA0000A1Z5"
              maxLength={15}
              className="px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs uppercase focus:ring-2 focus:ring-indigo-600 focus:outline-none flex-1"
            />
            <button
              type="submit"
              disabled={savingGst}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {savingGst ? 'Saving...' : 'Save GSTIN'}
            </button>
          </form>

          {gstSavedMsg && (
            <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> GSTIN successfully saved to your profile.
            </p>
          )}
        </div>
      </div>

      {/* Switch / Upgrade Plan Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          {subscription?.status === 'active' ? 'Change or Upgrade Plan' : 'Select a Hosting Plan'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent = subscription?.status === 'active' && currentPlan?.id === p.id;
            const rawRate = p.gstRate !== undefined ? Number(p.gstRate) : 18;
            const rateMultiplier = rawRate > 1 ? rawRate / 100 : rawRate;
            const gstPercentage = rawRate > 1 ? rawRate : Math.round(rawRate * 100);
            const gst = Number((p.price * rateMultiplier).toFixed(2));
            const total = (p.price + gst).toFixed(2);
            const isLoading = loadingPlanId === p.id;

            return (
              <div
                key={p.id}
                className={`p-6 rounded-2xl border bg-white flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{p.description}</p>
                  <div className="text-2xl font-extrabold text-slate-900 mb-1">
                    ₹{p.price} <span className="text-xs font-normal text-slate-500">/ mo</span>
                  </div>
                  <p className="text-[11px] text-indigo-600 mb-4">
                    + {gstPercentage}% GST (₹{gst}) = ₹{total} total
                  </p>
                </div>

                <button
                  disabled={isCurrent || isLoading}
                  onClick={() => handleUpgradePlan(p)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isLoading
                    ? 'Processing...'
                    : subscription?.status === 'active'
                    ? `Switch to ${p.name}`
                    : `Activate ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tax Invoices Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Tax Invoices & Payment History
          </h2>
          <span className="text-xs text-slate-500 font-medium">18% GST compliant</span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No invoices generated yet. Invoices appear automatically after completed subscription payments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Base Plan</th>
                  <th className="py-2.5 px-4">18% GST</th>
                  <th className="py-2.5 px-4">Total Paid</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(inv.issuedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-semibold">
                      ₹{inv.subtotal}
                    </td>
                    <td className="py-3 px-4 text-indigo-600 font-semibold">
                      ₹{inv.gstAmount}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{inv.totalAmount}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tax Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Invoice Header */}
            <div className="border-b border-slate-200 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    TAX INVOICE
                  </h2>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Invoice No: <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(selectedInvoice.issuedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-slate-900">VIVEXA HOSTING</p>
                  <p className="text-slate-500">vivexatech.in</p>
                  <p className="text-slate-500">GSTIN: 29AAAAA0000A1Z5</p>
                  <p className="text-slate-500">Bengaluru, Karnataka, India</p>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-6 text-xs text-slate-600 space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                Billed To:
              </p>
              <p className="font-semibold text-slate-900">{selectedInvoice.customerName}</p>
              <p>{selectedInvoice.customerEmail}</p>
              {selectedInvoice.customerGstin && (
                <p className="font-mono text-indigo-700 font-semibold">
                  GSTIN: {selectedInvoice.customerGstin}
                </p>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-xs text-left mb-6 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">SAC Code</th>
                  <th className="py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-semibold text-slate-900">
                    {selectedInvoice.planName} Subscription &bull; 1 Month Hosting
                  </td>
                  <td className="py-3 text-right font-mono text-slate-500">998315</td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    ₹{selectedInvoice.subtotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Tax Calculations */}
            <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-700 mb-6">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">₹{selectedInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-600">
                <span>GST (18%):</span>
                <span className="font-semibold">₹{selectedInvoice.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount Paid:</span>
                <span>₹{selectedInvoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
