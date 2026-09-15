import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/project.service';
import { domainService } from '../../services/domain.service';
import { ROOT_DOMAIN } from '../../config/constants';
import { Project, Deployment, DomainRecord } from '../../types';
import {
  FolderGit2,
  GitBranch,
  Globe,
  ExternalLink,
  Rocket,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  Settings,
} from 'lucide-react';

export const ProjectDetailView: React.FC = () => {
  const { params, navigate } = useRouter();
  const { user } = useAuth();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'deployments' | 'env'>('overview');

  const [loading, setLoading] = useState(true);
  const [redeploying, setRedeploying] = useState(false);

  // Custom Domain input
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Env vars
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');

  const loadData = async () => {
    if (!projectId) return;
    try {
      const p = await projectService.getProjectById(projectId);
      if (!p) {
        navigate('/dashboard/projects');
        return;
      }
      setProject(p);

      const dList = await projectService.getProjectDeployments(projectId);
      setDeployments(dList);

      const domList = await domainService.getProjectDomains(projectId);
      setDomains(domList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleRedeploy = async () => {
    if (!project || !user) return;
    setRedeploying(true);
    try {
      await projectService.triggerRedeploy(project.id, user.uid);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger redeploy');
    } finally {
      setRedeploying(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !user || !newDomain.trim()) return;

    setAddingDomain(true);
    setDomainError(null);

    try {
      await domainService.addCustomDomain({
        domain: newDomain.trim(),
        projectId: project.id,
        projectName: project.name,
        userId: user.uid,
        vercelProjectId: project.vercelProjectId,
      });
      setNewDomain('');
      await loadData();
    } catch (err: any) {
      setDomainError(err.message || 'Could not add custom domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await domainService.verifyDomain(domainId);
      if (res.verified) {
        alert('Domain verified successfully! SSL certificate is active.');
      } else {
        alert(res.message || 'DNS record not yet resolved. Please allow a few minutes for propagation.');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Verification check failed');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!user || !confirm('Remove this domain from your project?')) return;
    try {
      await domainService.removeDomain(domainId, user.uid);
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove domain');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAddEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !envKey.trim()) return;
    const nextEnv = { ...(project.envVars || {}), [envKey.trim()]: envVal };
    await projectService.updateProject(project.id, { envVars: nextEnv });
    setProject({ ...project, envVars: nextEnv });
    setEnvKey('');
    setEnvVal('');
  };

  const handleDeleteEnv = async (k: string) => {
    if (!project) return;
    const nextEnv = { ...(project.envVars || {}) };
    delete nextEnv[k];
    await projectService.updateProject(project.id, { envVars: nextEnv });
    setProject({ ...project, envVars: nextEnv });
  };

  if (loading || !project) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-1/3"></div>
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  const primaryUrl = `https://${project.vivexaSubdomain}`;

  return (
    <div className="space-y-8">
      {/* Back button & Title header */}
      <div>
        <button
          onClick={() => navigate('/dashboard/projects')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {project.name}
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  project.status === 'READY'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : project.status === 'BUILDING'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {project.status}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-mono">
              <a
                href={primaryUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1 font-bold"
              >
                {project.vivexaSubdomain}
                <ExternalLink className="w-3 h-3" />
              </a>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" />
                {project.branch}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-redeploy"
              disabled={redeploying}
              onClick={handleRedeploy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${redeploying ? 'animate-spin' : ''}`} />
              {redeploying ? 'Triggering...' : 'Redeploy'}
            </button>
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Visit Website
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs font-semibold">
        {(['overview', 'domains', 'deployments', 'env'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-project-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 capitalize transition-colors cursor-pointer ${
              activeTab === tab
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'env' ? 'Environment Variables' : tab}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Live Preview Box */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">{primaryUrl}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active on Vercel Edge
                </span>
              </div>
              <div className="p-8 text-center bg-slate-900 text-white min-h-[220px] flex flex-col items-center justify-center">
                <Globe className="w-12 h-12 text-indigo-400 mb-3 opacity-90" />
                <h3 className="text-lg font-bold mb-1">{project.name}</h3>
                <p className="text-xs text-slate-400 max-w-sm font-mono mb-4">
                  {project.vivexaSubdomain}
                </p>
                <a
                  href={primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  Open Live Website
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Build Specifications */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Build Specifications</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Framework</dt>
                  <dd className="font-semibold text-slate-800 mt-1 capitalize">{project.framework}</dd>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Build Command</dt>
                  <dd className="font-semibold text-slate-800 mt-1">{project.buildCommand || 'npm run build'}</dd>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Output Directory</dt>
                  <dd className="font-semibold text-slate-800 mt-1">{project.outputDirectory || 'dist'}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Git Connection card */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
                Git Repository
              </h3>
              <div className="text-xs space-y-2 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Repository:</span>{' '}
                  <span className="font-mono">{project.repositoryName}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Branch:</span>{' '}
                  <span className="font-mono">{project.branch}</span>
                </p>
                {project.repositoryUrl && (
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline mt-2"
                  >
                    View on GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DOMAINS */}
      {activeTab === 'domains' && (
        <div className="space-y-8">
          {/* Subdomain Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              System Subdomain
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  {project.vivexaSubdomain}
                </h3>
                <p className="text-xs text-slate-500">
                  Managed wildcard edge routing &bull; Automatic SSL
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            </div>
          </div>

          {/* Add Custom Domain Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Attach Custom Domain</h3>
            <p className="text-xs text-slate-500">
              Point your domain registrar (GoDaddy, Namecheap, Cloudflare) to our Vercel edge nodes.
            </p>

            {domainError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {domainError}
              </div>
            )}

            <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
              <input
                id="input-add-custom-domain"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="mybrand.com or app.mybrand.com"
                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                id="btn-add-custom-domain"
                type="submit"
                disabled={addingDomain}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {addingDomain ? 'Attaching...' : 'Add Domain'}
              </button>
            </form>
          </div>

          {/* Custom Domains List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Connected Custom Domains</h3>
            {domains.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                No custom domains attached to this project yet.
              </div>
            ) : (
              domains.map((dom) => (
                <div
                  key={dom.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 font-mono">
                          {dom.domainName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dom.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {dom.status === 'active' ? 'Active' : 'Verification Required'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Added on {new Date(dom.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVerifyDomain(dom.id)}
                        disabled={verifyingDomainId === dom.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                      >
                        {verifyingDomainId === dom.id ? 'Checking...' : 'Verify DNS'}
                      </button>
                      <button
                        onClick={() => handleDeleteDomain(dom.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* DNS Record Helper Table */}
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      Required DNS Record (Add at your DNS provider):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">TYPE</span>
                        <span className="font-bold text-indigo-600">{dom.dnsRecords?.type || 'CNAME'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">HOST / NAME</span>
                        <span className="font-semibold text-slate-800">{dom.dnsRecords?.host || '@'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-sans font-bold text-slate-400 block">VALUE / TARGET</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {dom.dnsRecords?.value || 'cname.vercel-dns.com'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(dom.dnsRecords?.value || 'cname.vercel-dns.com')}
                          className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                        >
                          {copiedText === dom.dnsRecords?.value ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: DEPLOYMENTS */}
      {activeTab === 'deployments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Deployment History</h3>
            <button
              onClick={handleRedeploy}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Trigger New Build
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {deployments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No deployment history yet.
              </p>
            ) : (
              deployments.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {d.commitMessage || 'Automated build'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700'
                            : d.status === 'BUILDING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {d.branch} &bull; {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      Inspect
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: ENVIRONMENT VARIABLES */}
      {activeTab === 'env' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Environment Variables</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Encrypted environment variables are securely injected into your build and runtime on Vercel.
            </p>
          </div>

          <form onSubmit={handleAddEnv} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="VARIABLE_NAME"
              className="w-full sm:w-1/3 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              value={envVal}
              onChange={(e) => setEnvVal(e.target.value)}
              placeholder="value"
              className="w-full sm:w-1/2 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Add
            </button>
          </form>

          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-4">
            {!project.envVars || Object.keys(project.envVars).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No environment variables configured.
              </p>
            ) : (
              Object.entries(project.envVars).map(([k, v]) => (
                <div key={k} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-800">{k}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">••••••••••••</span>
                    <button
                      onClick={() => handleDeleteEnv(k)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
