'use client';

import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { Subscription } from '../../types';
import { Repeat } from 'lucide-react';

export const AdminSubscriptionsView: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllSubscriptions().then((res) => {
      setSubs(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Subscriptions
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Active, cancelled, and renewing customer subscriptions.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading subscriptions...</div>
        ) : subs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No active subscriptions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="py-3 px-6">User ID</th>
                  <th className="py-3 px-6">Plan</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Current Period End</th>
                  <th className="py-3 px-6">Cancel At End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-semibold text-slate-800">
                      {s.userId}
                    </td>
                    <td className="py-3.5 px-6 font-sans font-bold text-indigo-600">
                      {s.planId.toUpperCase()}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-sans ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {s.currentPeriodEnd
                        ? new Date(s.currentPeriodEnd).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-6 font-sans text-xs">
                      {s.cancelAtPeriodEnd ? (
                        <span className="text-amber-700 font-bold">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
