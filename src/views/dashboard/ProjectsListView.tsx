'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/project.service';
import { Project } from '../../types';
import {
  FolderGit2,
  Plus,
  Search,
  ExternalLink,
  GitBranch,
  Globe,
  Clock,
  Trash2,
  ArrowRight,
} from 'lucide-react';

export const ProjectsListView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = async () => {
    if (user) {
      const list = await projectService.getUserProjects(user.uid);
      setProjects(list);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    const confirmed = confirm(
      `Are you sure you want to delete "${project.name}"?
This action cannot be undone and will remove associated domains and Vercel edge links.`
    );
    if (!confirmed || !user) return;

    setDeletingId(project.id);
    try {
      await projectService.deleteProject(project.id, user.uid);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.productionUrl && p.productionUrl.toLowerCase().includes(search.toLowerCase())) ||
      (p.customDomains && p.customDomains.some((d) => d.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Projects
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your websites, edge deployments, and connected Git repositories.
          </p>
        </div>

        <button
          id="btn-projects-new"
          onClick={() => navigate('/dashboard/projects/new')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          id="input-projects-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name or domain..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-2xs"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center max-w-xl mx-auto">
          <FolderGit2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {search ? 'No projects matching your search' : 'No projects yet'}
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            {search
              ? 'Try a different search keyword.'
              : 'Import your first GitHub repository and deploy it in minutes.'}
          </p>
          {!search && (
            <button
              onClick={() => navigate('/dashboard/projects/new')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/dashboard/projects/${p.id}`)}
              className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer group shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                    {p.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      p.status === 'READY'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : p.status === 'BUILDING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Domain or Vercel URL */}
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-mono mb-4 truncate">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {p.customDomains && p.customDomains.length > 0
                      ? p.customDomains[0]
                      : p.productionUrl
                      ? p.productionUrl.replace(/^https?:\/\//, '')
                      : 'No custom domain'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <GitBranch className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{p.repositoryName || 'git-repo'}</span>
                    <span className="text-slate-400 font-mono">({p.branch})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 flex items-center gap-1">
                  Configure Project
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>

                <button
                  type="button"
                  title="Delete Project"
                  disabled={deletingId === p.id}
                  onClick={(e) => handleDelete(e, p)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
