'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/project.service';
import { Deployment } from '../../types';
import { Rocket, ExternalLink, GitBranch, Clock, RefreshCw } from 'lucide-react';

export const DeploymentsView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDeployments = async () => {
    if (!user) return;
    try {
      const list = await projectService.getUserDeployments(user.uid);
      setDeployments(list);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load deployments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Deployments History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time feed of all builds deployed to the Vercel edge network across all your projects.
          </p>
        </div>

        <button
          onClick={loadDeployments}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 bg-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {loadError && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading deployments...</div>
        ) : deployments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <Rocket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>No deployments recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Project</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Branch & Commit</th>
                  <th className="py-3 px-6">Time</th>
                  <th className="py-3 px-6 text-right">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {d.projectName || 'Project'}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : d.status === 'BUILDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      <div className="font-medium text-slate-900 truncate max-w-xs">
                        {d.commitMessage || 'Automated build'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <GitBranch className="w-3 h-3" />
                        {d.branch}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline"
                        >
                          Visit
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
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
