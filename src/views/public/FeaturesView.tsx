import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { ROOT_DOMAIN } from '../../config/constants';
import {
  GitBranch,
  Globe,
  Zap,
  ShieldCheck,
  Server,
  Layers,
  ArrowRight,
  Terminal,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export const FeaturesView: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Platform Architecture & Capabilities
        </h1>
        <p className="text-base sm:text-lg text-slate-600">
          Built on top of Vercel edge infrastructure, Vivexa combines the power of atomic deployments with seamless domain management and Indian GST billing.
        </p>
      </div>

      <div className="space-y-16">
        {/* Section 1: GitHub */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <GitBranch className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Automated Git Workflows & Atomic Builds
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Connect your GitHub account securely. Whenever you push to your default branch or create revisions, Vivexa instructs the Vercel infrastructure to pull your code, execute your build pipeline, and produce an immutable deployment.
            </p>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Automatic framework detection for Next.js, Vite, React, Vue, and Astro
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Zero downtime instant rollback to any previous deployment
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Custom build commands and customizable output directories
              </li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs shadow-xl border border-slate-800">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-400 text-[11px]">
              <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              <span className="ml-2 font-semibold">build-output &bull; vercel-edge</span>
            </div>
            <div className="pt-4 space-y-1 text-slate-300">
              <p className="text-emerald-400">&gt; git push origin main</p>
              <p className="text-slate-500">&gt; Webhook received by Vivexa Engine</p>
              <p className="text-slate-400">&gt; Framework detected: Next.js (App Router)</p>
              <p className="text-indigo-400">&gt; Building static routes & edge lambdas...</p>
              <p className="text-emerald-400 font-bold">&gt; Deployment READY: https://portfolio.{ROOT_DOMAIN}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Subdomains & Custom Domains */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center lg:flex-row-reverse">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              DNS Configuration Matrix
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-500 text-[11px]">Vivexa Subdomain (Free)</p>
                <p className="font-bold text-indigo-600">*.{ROOT_DOMAIN} &rarr; Wildcard Edge DNS</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-500 text-[11px]">Apex Domain (@)</p>
                <p className="font-bold text-slate-800">Type: A &bull; Value: 76.76.21.21</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-500 text-[11px]">Subdomain / CNAME</p>
                <p className="font-bold text-slate-800">Type: CNAME &bull; Value: cname.vercel-dns.com</p>
              </div>
            </div>
          </div>

          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Instant Free Subdomains & Custom Domains
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Every project instantly receives a free subdomain under <span className="font-semibold text-slate-900">*.{ROOT_DOMAIN}</span>. When you are ready for your own brand, attach custom domains with our automated DNS verification engine.
            </p>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Reserved name protection prevents phishing and system spoofing
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Free automated SSL certificates provisioned via Let's Encrypt
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Real-time DNS check button with diagnostic feedback
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-20 text-center">
        <button
          onClick={() => navigate('/signup')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Start Hosting on Vivexa
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
