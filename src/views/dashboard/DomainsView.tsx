import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { domainService } from '../../services/domain.service';
import { projectService } from '../../services/project.service';
import { ROOT_DOMAIN } from '../../config/constants';
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
} from 'lucide-react';

export const DomainsView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadData = async () => {
    if (user) {
      const [dList, pList] = await Promise.all([
        domainService.getUserDomains(user.uid),
        projectService.getUserProjects(user.uid),
      ]);
      setDomains(dList);
      setProjects(pList);
      setLoading(false);
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
        alert('Domain verified successfully! SSL is active.');
      } else {
        alert(res.message || 'DNS not yet resolving. Please allow time for propagation.');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!user || !confirm('Are you sure you want to remove this domain?')) return;
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Domain Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View all your free *.{ROOT_DOMAIN} subdomains and custom domain DNS routing records.
        </p>
      </div>

      {/* Free Subdomains Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600" />
          Free Vivexa Subdomains (*.{ROOT_DOMAIN})
        </h2>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No projects or subdomains provisioned yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900 font-sans">{p.name}</span>
                  <a
                    href={`https://${p.vivexaSubdomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    https://{p.vivexaSubdomain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-sans">
                  Active Edge SSL
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Domains Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Connected Custom Domains</h2>
          <button
            onClick={() => navigate('/dashboard/projects')}
            className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
          >
            Attach from Project settings &rarr;
          </button>
        </div>

        {domains.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No custom domains configured yet. Open any project and select "Domains" to attach one.
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((dom) => (
              <div
                key={dom.id}
                className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {dom.domainName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dom.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {dom.status === 'active' ? 'Verified' : 'Verification Required'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(dom.id)}
                      disabled={verifyingId === dom.id}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                    >
                      {verifyingId === dom.id ? 'Checking...' : 'Verify DNS'}
                    </button>
                    <button
                      onClick={() => handleDelete(dom.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-sans text-slate-400 block font-bold">TYPE</span>
                    <span className="font-bold text-indigo-600">{dom.dnsRecords?.type || 'CNAME'}</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] font-sans text-slate-400 block font-bold">NAME</span>
                    <span>{dom.dnsRecords?.host || '@'}</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block font-bold">TARGET</span>
                      <span className="truncate">{dom.dnsRecords?.value || 'cname.vercel-dns.com'}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(dom.dnsRecords?.value || 'cname.vercel-dns.com')}
                      className="text-slate-400 hover:text-slate-800"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
