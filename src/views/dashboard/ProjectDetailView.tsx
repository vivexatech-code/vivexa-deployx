'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/project.service';
import { domainService } from '../../services/domain.service';
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
  Star,
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
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
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
      // Filter out legacy subdomain records
      const customOnly = domList.filter(
        (d) => d.type !== 'vivexa_subdomain' && !d.domain.endsWith('.vivexatech.in')
      );
      setDomains(customOnly);
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
        alert('Domain verified successfully! SSL certificate is active on Vercel edge network.');
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

  const handleSetPrimary = async (domainId: string) => {
    setSettingPrimaryId(domainId);
    try {
      await domainService.setPrimaryDomain(domainId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to set primary domain');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    if (!user || !confirm(`Remove ${domainName} from this project?`)) return;
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

  const primaryDomainRecord = domains.find((d) => d.isPrimary && (d.status === 'active' || d.verified))
    || domains.find((d) => d.status === 'active' || d.verified)
    || domains[0];

  const primaryUrl = primaryDomainRecord
    ? `https://${primaryDomainRecord.domain}`
    : project.productionUrl
    ? (project.productionUrl.startsWith('http') ? project.productionUrl : `https://${project.productionUrl}`)
    : null;

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

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-mono flex-wrap">
              {primaryUrl ? (
                <a
                  href={primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {primaryUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  No custom domain connected
                </span>
              )}
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-sans">
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
            {primaryUrl && (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Visit Website
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
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
            {tab === 'env' ? 'Environment Variables' : tab === 'domains' ? `Domains (${domains.length})` : tab}
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
                <span className="font-mono">
                  {primaryUrl || 'Awaiting custom domain connection'}
                </span>
                {primaryDomainRecord?.status === 'active' || primaryDomainRecord?.verified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Live on Vercel Edge
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {project.status === 'READY' ? 'Ready for Custom Domain' : 'Build in Progress'}
                  </span>
                )}
              </div>
              <div className="p-8 text-center bg-slate-900 text-white min-h-[220px] flex flex-col items-center justify-center">
                <Globe className="w-12 h-12 text-indigo-400 mb-3 opacity-90" />
                <h3 className="text-lg font-bold mb-1">{project.name}</h3>
                <p className="text-xs text-slate-400 max-w-sm font-mono mb-4">
                  {primaryUrl || 'No custom domain configured'}
                </p>
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    Open Live Website
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    onClick={() => setActiveTab('domains')}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Connect Custom Domain
                  </button>
                )}
              </div>
            </div>

            {/* Build Specifications */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Build Specifications</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Framework</dt>
                  <dd className="font-semibold text-slate-800 mt-1 capitalize">{project.framework || 'Static'}</dd>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Root Directory</dt>
                  <dd className="font-semibold text-slate-800 mt-1 truncate" title={project.rootDirectory || './'}>
                    {project.rootDirectory ? `./${project.rootDirectory}` : './ (Root)'}
                  </dd>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-slate-400 text-[10px] uppercase font-sans font-bold">Build Command</dt>
                  <dd className="font-semibold text-slate-800 mt-1 truncate" title={project.buildCommand || 'None'}>
                    {project.buildCommand || 'None (Static)'}
                  </dd>
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
                <p>
                  <span className="font-semibold text-slate-800">Root Directory:</span>{' '}
                  <span className="font-mono">{project.rootDirectory ? `./${project.rootDirectory}` : './ (Root)'}</span>
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
          {/* Add Custom Domain Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Connect Custom Domain</h3>
            </div>
            <p className="text-xs text-slate-500">
              Point your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare, Google Domains) to Vercel's global edge network.
            </p>

            {domainError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{domainError}</span>
              </div>
            )}

            <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
              <input
                id="input-add-custom-domain"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. mybrand.com or app.mybrand.com"
                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
              <button
                id="btn-add-custom-domain"
                type="submit"
                disabled={addingDomain || !newDomain.trim()}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {addingDomain ? 'Connecting...' : 'Add Domain'}
              </button>
            </form>
          </div>

          {/* Custom Domains List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Connected Custom Domains</h3>
            {domains.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 space-y-2">
                <Globe className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No custom domains connected yet</p>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Add your apex domain (e.g. yourdomain.com) or subdomain (e.g. app.yourdomain.com) above to route production visitors.
                </p>
              </div>
            ) : (
              domains.map((dom) => {
                const isApex = dom.domain.split('.').length === 2;
                const records = dom.dnsRecords && Array.isArray(dom.dnsRecords) && dom.dnsRecords.length > 0
                  ? dom.dnsRecords
                  : [
                      {
                        type: dom.dnsRecordType || (isApex ? 'A' : 'CNAME'),
                        host: dom.dnsHost || (isApex ? '@' : dom.domain.split('.')[0]),
                        value: dom.dnsValue || (isApex ? '76.76.21.21' : 'cname.vercel-dns.com'),
                        status: dom.status,
                      },
                    ];

                return (
                  <div
                    key={dom.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-base text-slate-900 font-mono">
                            {dom.domain}
                          </span>
                          {dom.isPrimary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-indigo-600" /> Primary
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                              dom.status === 'active' || dom.verified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {dom.status === 'active' || dom.verified ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Active & Verified
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3" /> DNS Verification Required
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Connected on {new Date(dom.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!dom.isPrimary && (dom.status === 'active' || dom.verified) && (
                          <button
                            onClick={() => handleSetPrimary(dom.id)}
                            disabled={settingPrimaryId === dom.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                          >
                            {settingPrimaryId === dom.id ? 'Setting...' : 'Set as Primary'}
                          </button>
                        )}
                        <button
                          onClick={() => handleVerifyDomain(dom.id)}
                          disabled={verifyingDomainId === dom.id}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {verifyingDomainId === dom.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                              Checking...
                            </>
                          ) : (
                            'Verify DNS'
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(dom.id, dom.domain)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remove Domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* DNS Records required table */}
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-700">
                        Required DNS Records (configure at your domain registrar):
                      </p>
                      <div className="space-y-2">
                        {records.map((rec, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono"
                          >
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-sans font-bold text-slate-400 block">TYPE</span>
                              <span className="font-bold text-indigo-600">{rec.type}</span>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-sans font-bold text-slate-400 block">HOST / NAME</span>
                              <span className="font-semibold text-slate-800">{rec.host}</span>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <span className="text-[10px] font-sans font-bold text-slate-400 block">VALUE / TARGET</span>
                                <span className="font-semibold text-slate-800 truncate block">
                                  {rec.value}
                                </span>
                              </div>
                              <button
                                onClick={() => handleCopy(rec.value)}
                                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer shrink-0"
                                title="Copy Value"
                              >
                                {copiedText === rec.value ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Vercel Domain Verification TXT if required */}
                      {dom.verification && dom.verification.length > 0 && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1 font-sans">
                          <p className="font-bold text-amber-900 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Domain Verification Required
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Vercel requires an ownership verification record. Add the following TXT record to your DNS zone:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs pt-1">
                            <div className="p-1.5 bg-white rounded border border-amber-200">
                              <span className="text-[9px] font-sans text-slate-400 block font-bold">TYPE</span>
                              <span className="font-bold text-amber-700">TXT</span>
                            </div>
                            <div className="p-1.5 bg-white rounded border border-amber-200">
                              <span className="text-[9px] font-sans text-slate-400 block font-bold">NAME</span>
                              <span className="truncate block">{dom.verification[0].domain}</span>
                            </div>
                            <div className="p-1.5 bg-white rounded border border-amber-200 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <span className="text-[9px] font-sans text-slate-400 block font-bold">VALUE</span>
                                <span className="truncate block">{dom.verification[0].value}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(dom.verification![0].value)}
                                className="text-slate-400 hover:text-slate-800 p-1 cursor-pointer"
                              >
                                {copiedText === dom.verification[0].value ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
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
