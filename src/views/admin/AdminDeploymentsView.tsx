'use client';

import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { Deployment } from '../../types';

export const AdminDeploymentsView: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllDeployments().then((res) => {
      setDeployments(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Platform Edge Deployments
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live feed of builds triggered across all user projects.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading deployments...</div>
        ) : deployments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No deployments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 font-sans">
                  <th className="py-3 px-6">Deployment ID</th>
                  <th className="py-3 px-6">Project ID</th>
                  <th className="py-3 px-6">Branch</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {d.id}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {d.projectId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-700">
                      {d.branch}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(d.createdAt).toLocaleString()}
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
