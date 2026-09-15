import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { DomainRecord } from '../../types';

export const AdminDomainsView: React.FC = () => {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllDomains().then((res) => {
      setDomains(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          All Platform Domains
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          All custom domains and subdomains configured across the platform.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading domains...</div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No domains registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 font-sans">
                  <th className="py-3 px-6">Domain Name</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Project ID</th>
                  <th className="py-3 px-6">User ID</th>
                  <th className="py-3 px-6">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {domains.map((dom) => (
                  <tr key={dom.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {dom.domainName}
                    </td>
                    <td className="py-3.5 px-6 font-sans capitalize text-slate-700">
                      {dom.type}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dom.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {dom.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {dom.projectId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {dom.userId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(dom.createdAt).toLocaleDateString()}
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
