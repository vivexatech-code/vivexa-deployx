import React, { useEffect, useState } from 'react';
import { planService } from '../../services/plan.service';
import { Plan } from '../../types';
import { Layers, Save, CheckCircle2 } from 'lucide-react';

export const AdminPlansView: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    planService.getPlans().then((res) => {
      setPlans(res);
      setLoading(false);
    });
  }, []);

  const handleChange = (planId: string, field: keyof Plan, val: any) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, [field]: val } : p))
    );
  };

  const handleSave = async (plan: Plan) => {
    setSavingId(plan.id);
    try {
      await planService.updatePlan(plan.id, {
        price: Number(plan.price),
        maxProjects: Number(plan.maxProjects),
        maxDomains: Number(plan.maxDomains),
        maxSubdomains: Number(plan.maxSubdomains),
        maxDeployments: Number(plan.maxDeployments),
        bandwidthLimit: plan.bandwidthLimit,
        highlight: Boolean(plan.highlight),
      });
      setSavedSuccessId(plan.id);
      setTimeout(() => setSavedSuccessId(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading plan settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Plan & Pricing Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure tier entitlements, prices in INR (18% GST is dynamically calculated), and quotas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((p) => {
          const gst = Number((p.price * 0.18).toFixed(2));
          const total = (p.price + gst).toFixed(2);

          return (
            <div
              key={p.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={Boolean(p.highlight)}
                    onChange={(e) => handleChange(p.id, 'highlight', e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Featured
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Base Price (INR ₹)
                </label>
                <input
                  type="number"
                  value={p.price}
                  onChange={(e) => handleChange(p.id, 'price', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  + 18% GST (₹{gst}) = <span className="font-bold text-slate-800">₹{total} total</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Projects</label>
                  <input
                    type="number"
                    value={p.maxProjects}
                    onChange={(e) => handleChange(p.id, 'maxProjects', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Domains</label>
                  <input
                    type="number"
                    value={p.maxDomains}
                    onChange={(e) => handleChange(p.id, 'maxDomains', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subdomains</label>
                  <input
                    type="number"
                    value={p.maxSubdomains}
                    onChange={(e) => handleChange(p.id, 'maxSubdomains', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monthly Builds</label>
                  <input
                    type="number"
                    value={p.maxDeployments}
                    onChange={(e) => handleChange(p.id, 'maxDeployments', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bandwidth Quota
                </label>
                <input
                  type="text"
                  value={p.bandwidthLimit}
                  onChange={(e) => handleChange(p.id, 'bandwidthLimit', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  disabled={savingId === p.id}
                  onClick={() => handleSave(p)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingId === p.id ? 'Saving...' : 'Save Changes'}
                </button>
                {savedSuccessId === p.id && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Updated
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
