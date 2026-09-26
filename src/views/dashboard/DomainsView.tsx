'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { domainService } from '../../services/domain.service';
import { projectService } from '../../services/project.service';
import { planService } from '../../services/plan.service';
import { DomainRecord, Project } from '../../types';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Star,
  ShieldCheck,
} from 'lucide-react';

export const DomainsView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  // New Domain Modal / Inline form
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inputDomain, setInputDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    if (user) {
      try {
        const [dList, pList] = await Promise.all([
          domainService.getUserDomains(user.uid),
          projectService.getUserProjects(user.uid),
        ]);
        // Strictly filter out any legacy subdomain records
        const customOnly = dList.filter(
          (d) => d.type !== 'vivexa_subdomain' && !d.domain.endsWith('.vivexatech.in')
        );
        setDomains(customOnly);
        setProjects(pList);
        setLoadError(null);
        if (pList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(pList[0].id);
        }
      } catch (err: any) {
        setLoadError(err.message || 'Could not load domains.');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleVerify = async (domainId: string) => {
    setVerifyingId(domainId);
    try {
      const res = await domainService.verifyDomain(domainId);
      if (res.verified) {
        alert('Domain verified successfully! SSL certificate is active on Vercel edge network.');
      } else {
        alert(res.message || 'DNS changes have not propagated yet. Please ensure the DNS records match below.');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
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

  const handleDelete = async (domainId: string, domainName: string) => {
    if (!user || !confirm(`Are you sure you want to remove ${domainName}? This will disconnect it from Vercel edge routing.`)) return;
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

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !inputDomain.trim() || !user) return;

    setAddingDomain(true);
    setAddError(null);

    try {
      const entitlement = await planService.canAddDomain(user.uid);
      if (!entitlement.allowed) {
        setAddError(entitlement.reason);
        setAddingDomain(false);
        return;
      }

      await domainService.addCustomDomain({
        domain: inputDomain.trim(),
        projectId: selectedProjectId,
        userId: user?.uid,
      });
      setInputDomain('');
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add custom domain');
    } finally {
      setAddingDomain(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-indigo-600" />
            Custom Domains
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connect and manage your branded domains. Configure DNS records to route global edge traffic to your deployments.
          </p>
        </div>

        {projects.length > 0 && (
          <button
            id="btn-add-custom-domain"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Custom Domain
          </button>
        )}
      </div>

      {loadError && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Connect Custom Domain</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddDomain} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Domain Name</label>
                <input
                  type="text"
                  placeholder="e.g. yourcompany.com or app.yourcompany.com"
                  value={inputDomain}
                  onChange={(e) => setInputDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter apex domain (example.com) or subdomain (app.example.com).
                </p>
              </div>

              {addError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDomain || !inputDomain.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {addingDomain ? 'Connecting...' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connected Custom Domains */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            <span>Loading custom domains...</span>
          </div>
        ) : domains.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">No custom domains connected</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Deploy your project to Vercel and attach your custom domain to route production traffic to your site.
              </p>
            </div>
            {projects.length > 0 ? (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                Connect Your First Domain
              </button>
            ) : (
              <button
                onClick={() => navigate('/dashboard/projects/new')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                Deploy a Project First
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((dom) => {
              const proj = projects.find((p) => p.id === dom.projectId);
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
                  className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {dom.domain}
                        </span>
                        {dom.isPrimary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-indigo-600" /> Primary
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
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
                              <AlertCircle className="w-3 h-3" /> DNS Propagation Pending
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>Project: <strong className="text-slate-700">{proj?.name || dom.projectName || dom.projectId}</strong></span>
                        <span>•</span>
                        <a
                          href={`https://${dom.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 font-mono"
                        >
                          https://{dom.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!dom.isPrimary && (dom.status === 'active' || dom.verified) && (
                        <button
                          onClick={() => handleSetPrimary(dom.id)}
                          disabled={settingPrimaryId === dom.id}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                        >
                          {settingPrimaryId === dom.id ? 'Setting...' : 'Set Primary'}
                        </button>
                      )}
                      <button
                        onClick={() => handleVerify(dom.id)}
                        disabled={verifyingId === dom.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {verifyingId === dom.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                            Checking...
                          </>
                        ) : (
                          'Verify DNS'
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(dom.id, dom.domain)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Remove Domain"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* DNS Records required */}
                  <div className="pt-3 border-t border-slate-200/70 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Required DNS Configuration for {dom.domain}
                    </p>
                    <div className="space-y-2">
                      {records.map((rec, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono"
                        >
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <span className="text-[10px] font-sans text-slate-400 block font-bold">TYPE</span>
                            <span className="font-bold text-indigo-600">{rec.type}</span>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <span className="text-[10px] font-sans text-slate-400 block font-bold">NAME / HOST</span>
                            <span className="truncate">{rec.host}</span>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] font-sans text-slate-400 block font-bold">VALUE / TARGET</span>
                              <span className="truncate block">{rec.value}</span>
                            </div>
                            <button
                              onClick={() => handleCopy(rec.value)}
                              className="text-slate-400 hover:text-slate-800 shrink-0 p-1 cursor-pointer"
                              title="Copy value"
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

                    {/* Vercel Ownership TXT verification if required */}
                    {dom.verification && dom.verification.length > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1 font-sans">
                        <p className="font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Ownership Verification Required
                        </p>
                        <p className="text-[11px] text-amber-800">
                          To verify domain ownership on Vercel edge, add the following TXT record:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs pt-1">
                          <div className="p-1.5 bg-white rounded border border-amber-200">
                            <span className="text-[9px] font-sans text-slate-400 block font-bold">TYPE</span>
                            <span className="font-bold text-amber-700">TXT</span>
                          </div>
                          <div className="p-1.5 bg-white rounded border border-amber-200">
                            <span className="text-[9px] font-sans text-slate-400 block font-bold">NAME</span>
                            <span className="truncate">{dom.verification[0].domain}</span>
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
