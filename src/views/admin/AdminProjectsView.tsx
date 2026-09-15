import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { Project } from '../../types';
import { FolderGit2, ExternalLink } from 'lucide-react';

export const AdminProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllProjects().then((res) => {
      setProjects(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          All Platform Projects
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Global list of projects across all registered developers.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No projects created across the platform yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 font-sans">
                  <th className="py-3 px-6">Project Name</th>
                  <th className="py-3 px-6">Owner UID</th>
                  <th className="py-3 px-6">Subdomain</th>
                  <th className="py-3 px-6">Framework</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900 font-sans">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {p.userId}
                    </td>
                    <td className="py-3.5 px-6 text-indigo-600">
                      https://{p.vivexaSubdomain}
                    </td>
                    <td className="py-3.5 px-6 font-sans capitalize text-slate-700">
                      {p.framework}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
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
