import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { planService } from '../../services/plan.service';
import { ROOT_DOMAIN } from '../../config/constants';
import { Plan } from '../../types';
import {
  Rocket,
  GitBranch,
  Globe,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  Layers,
  Sparkles,
  Server,
  ChevronDown,
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const { navigate } = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    planService.getPlans().then((res) => setPlans(res));
  }, []);

  const steps = [
    { num: '01', title: 'Create Account', desc: 'Sign up in seconds with email or Google.' },
    { num: '02', title: 'Select a Plan', desc: 'Choose Starter, Pro, or Business with transparent 18% GST pricing.' },
    { num: '03', title: 'Import GitHub Repo', desc: 'Connect repositories directly with automated branch triggers.' },
    { num: '04', title: 'Deploy to Edge', desc: 'Build and distribute instantly over Vercel global infrastructure.' },
    { num: '05', title: 'Connect Your Domain', desc: `Get a free *.${ROOT_DOMAIN} subdomain or hook up custom DNS.` },
  ];

  const features = [
    {
      icon: GitBranch,
      title: 'GitHub Deployments',
      desc: 'Connect your GitHub repositories in one click. Every git push triggers an automated, atomic production build.',
    },
    {
      icon: Globe,
      title: 'Free Vivexa Subdomains',
      desc: `Every project receives a free instant subdomain under *.${ROOT_DOMAIN} with automatic SSL encryption.`,
    },
    {
      icon: Layers,
      title: 'Custom Domain Management',
      desc: 'Attach any domain you own. Live DNS verification instructions ensure zero-downtime cutovers.',
    },
    {
      icon: Zap,
      title: 'Global Edge Network',
      desc: 'Powered by Vercel edge infrastructure, delivering sub-100ms response times worldwide.',
    },
    {
      icon: ShieldCheck,
      title: 'Enterprise Security & SSL',
      desc: 'Automatic HTTPS certificates, isolated container environments, and comprehensive system audit logs.',
    },
    {
      icon: Server,
      title: 'Subscription-Based Hosting',
      desc: 'Predictable monthly billing via Razorpay with itemized 18% GST tax invoices and no surprise overages.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Modern Web Hosting Platform &bull; Powered by Vercel Edge
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
          Deploy without the complexity.
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Import your GitHub repositories, deploy high-performance websites across global edge infrastructure, and manage domains with zero DevOps friction.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            id="hero-cta-start"
            onClick={() => navigate('/signup')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md cursor-pointer"
          >
            Start Hosting
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            id="hero-cta-pricing"
            onClick={() => navigate('/pricing')}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-base bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
          >
            View Pricing
          </button>
        </div>

        {/* Subdomain teaser pill */}
        <div className="mt-12 inline-flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg">
          <span>Instant staging URL:</span>
          <span className="font-bold text-indigo-600">your-project.{ROOT_DOMAIN}</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-4">
              Engineered for developer velocity
            </h2>
            <p className="text-slate-600 text-base">
              Everything you need to ship web applications from code to custom domain in under two minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-4">
            How Vivexa Hosting Works
          </h2>
          <p className="text-slate-600 text-base">
            From registration to live production in five frictionless steps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-black text-indigo-600/70 font-mono block mb-3">
                  {s.num}
                </span>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2 block">
              Transparent Pricing &bull; 18% GST Included
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Three clear plans, zero surprises.
            </h2>
            <p className="text-slate-400 text-base">
              All plans include automatic SSL, global CDN delivery, and full tax invoicing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((p) => {
              const gst = Number((p.price * 0.18).toFixed(2));
              const total = (p.price + gst).toFixed(2);

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-8 flex flex-col justify-between transition-all ${
                    p.highlight
                      ? 'bg-slate-800 border-2 border-indigo-500 shadow-xl'
                      : 'bg-slate-950/60 border border-slate-800'
                  }`}
                >
                  <div>
                    {p.highlight && (
                      <span className="inline-block px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-wider mb-4">
                        Most Popular
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-white mb-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">{p.description}</p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-white">
                          ₹{p.price}
                        </span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </div>
                      <p className="text-[11px] text-indigo-300 mt-1">
                        + 18% GST (₹{gst}) = <span className="font-bold text-white">₹{total} total</span>
                      </p>
                    </div>

                    <ul className="space-y-3 mb-8 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Up to <strong>{p.maxProjects}</strong> Hosted Projects</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.maxDomains}</strong> Custom Domains</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.maxSubdomains}</strong> *.{ROOT_DOMAIN} Subdomains</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.maxDeployments}</strong> Deployments / mo</span>
                      </li>
                      {p.features?.slice(0, 3).map((feat, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-slate-400">
                          <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => navigate('/signup')}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      p.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    Select {p.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-12">
          Frequently Asked Questions
        </h2>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              How do the free *.vivexatech.in subdomains work?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every project you create can claim a unique subdomain (such as my-app.{ROOT_DOMAIN}). Subdomain routes are provisioned with automatic wildcard SSL and pointed directly to your Vercel edge build.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Can I connect custom domains I already own?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Yes! You can connect domains registered at GoDaddy, Namecheap, Cloudflare, etc. We provide clear CNAME and A record values that you can copy into your registrar DNS settings.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              How does the 18% GST calculation work?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              In accordance with Indian tax regulations, an 18% Goods and Services Tax (GST) is calculated on all plan prices (e.g. ₹499 base + ₹89.82 GST = ₹588.82 total). A tax invoice (VTX-YYYY-XXXXXX) is generated and downloadable immediately upon payment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
