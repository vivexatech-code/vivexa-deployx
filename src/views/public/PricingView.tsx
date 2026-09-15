import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { planService } from '../../services/plan.service';
import { billingService } from '../../services/billing.service';
import { ROOT_DOMAIN } from '../../config/constants';
import { Plan } from '../../types';
import { Check, ShieldCheck, HelpCircle } from 'lucide-react';

export const PricingView: React.FC = () => {
  const { navigate } = useRouter();
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    planService.getPlans().then((res) => setPlans(res));
  }, []);

  const handleSelectPlan = async (plan: Plan) => {
    if (!user) {
      navigate('/signup');
      return;
    }

    setLoadingPlanId(plan.id);
    setErrorMsg(null);

    try {
      await billingService.createCheckoutSession({
        planId: plan.id,
        userId: user.uid,
        userProfile: profile || {
          uid: user.uid,
          name: user.displayName || 'Developer',
          email: user.email || '',
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        onSuccess: (payment) => {
          setLoadingPlanId(null);
          navigate('/dashboard/billing');
        },
        onFailure: (err) => {
          setLoadingPlanId(null);
          setErrorMsg(err.message || 'Payment initiation failed');
        },
      });
    } catch (err: any) {
      setLoadingPlanId(null);
      setErrorMsg(err.message || 'Could not initiate Razorpay checkout');
    }
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Simple, Transparent Hosting Plans
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mb-4">
          Deploy unlimited revisions with real-time Vercel infrastructure, custom domain DNS, and dedicated SSL.
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Standard 18% GST itemized on every invoice with full tax compliance
        </div>
      </div>

      {errorMsg && (
        <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <p className="font-bold mb-1">Notice</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* 3 Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {plans.map((p) => {
          const gst = Number((p.price * 0.18).toFixed(2));
          const total = (p.price + gst).toFixed(2);
          const isLoading = loadingPlanId === p.id;

          return (
            <div
              key={p.id}
              className={`rounded-2xl p-8 flex flex-col justify-between bg-white border ${
                p.highlight
                  ? 'border-2 border-indigo-600 shadow-lg ring-4 ring-indigo-50'
                  : 'border-slate-200 shadow-2xs'
              }`}
            >
              <div>
                {p.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider mb-4">
                    Recommended
                  </span>
                )}
                <h2 className="text-2xl font-bold text-slate-900 mb-1">{p.name}</h2>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">{p.description}</p>

                {/* Pricing Block */}
                <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      ₹{p.price}
                    </span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Base Plan:</span>
                      <span className="font-semibold text-slate-900">₹{p.price}</span>
                    </div>
                    <div className="flex justify-between text-indigo-600 font-medium">
                      <span>GST @ 18%:</span>
                      <span>₹{gst}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Total Payable:</span>
                      <span>₹{total}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 text-xs text-slate-700">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>{p.maxProjects}</strong> Hosted Projects</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>{p.maxDomains}</strong> Custom Domains</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>{p.maxSubdomains}</strong> Free *.{ROOT_DOMAIN} Subdomains</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>{p.maxDeployments}</strong> Monthly Deployments</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>{p.bandwidthLimit}</strong> Bandwidth Quota</span>
                  </li>
                  {p.features?.map((feat, fi) => (
                    <li key={fi} className="flex items-center gap-2.5 text-slate-600">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                id={`pricing-btn-${p.id}`}
                disabled={isLoading}
                onClick={() => handleSelectPlan(p)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  p.highlight
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Preparing Checkout...' : `Select ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Tax note banner */}
      <div className="p-6 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-indigo-950 mb-1">
            Need GST Input Tax Credit (ITC) for your company?
          </h4>
          <p className="text-xs text-indigo-700">
            Enter your GSTIN in Dashboard Settings or during checkout to receive formal tax invoices valid for Indian ITC claims.
          </p>
        </div>
        <button
          onClick={() => navigate(user ? '/dashboard/billing' : '/signup')}
          className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          View Billing Settings
        </button>
      </div>
    </div>
  );
};
