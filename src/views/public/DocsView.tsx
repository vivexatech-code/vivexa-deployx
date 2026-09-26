'use client';

import React from 'react';
import { BookOpen, Terminal, Globe, GitBranch, CreditCard, ShieldCheck } from 'lucide-react';

export const DocsView: React.FC = () => {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-8 mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
          <BookOpen className="w-4 h-4" />
          Vivexa Developer Documentation
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Getting Started & Architecture Guide
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2">
          Everything you need to configure projects, manage DNS, understand Vercel infrastructure routing, and handle GST billing.
        </p>
      </div>

      <div className="space-y-12 text-sm text-slate-700 leading-relaxed">
        {/* Section 1: GitHub Connection */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <GitBranch className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">1. Connecting GitHub Repositories</h2>
          </div>
          <p className="mb-4">
            Vivexa integrates directly with GitHub using official OAuth authorization. No personal access tokens or manual token generation are ever required. To import your repositories:
          </p>
          <ol className="list-decimal pl-5 space-y-2 mb-4">
            <li>Navigate to <strong>Dashboard &rarr; Projects &rarr; Import Git Repository</strong>.</li>
            <li>Click <strong>Connect GitHub</strong> to open GitHub's official authorization dialog.</li>
            <li>Approve Vivexa DeployX to grant repository access (public and private).</li>
            <li>Search or select your repository and choose your desired deployment branch (e.g. <code className="font-mono text-xs text-slate-800 font-semibold">main</code>).</li>
            <li>Configure your build parameters and click <strong>Deploy Project</strong>.</li>
          </ol>
        </section>

        {/* Section 2: DNS & Custom Domains */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Globe className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">2. Custom Domain DNS Configuration</h2>
          </div>
          <p className="mb-4">
            When attaching a custom domain (e.g., <code className="font-mono text-xs">mybrand.com</code>), add the following DNS records at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="p-3 font-bold">Target</th>
                  <th className="p-3 font-bold">Type</th>
                  <th className="p-3 font-bold">Host / Name</th>
                  <th className="p-3 font-bold">Value / Points to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr>
                  <td className="p-3 text-slate-900 font-sans">Apex Domain (mybrand.com)</td>
                  <td className="p-3 font-bold text-indigo-600">A</td>
                  <td className="p-3">@</td>
                  <td className="p-3">76.76.21.21</td>
                </tr>
                <tr>
                  <td className="p-3 text-slate-900 font-sans">Subdomain (app.mybrand.com)</td>
                  <td className="p-3 font-bold text-indigo-600">CNAME</td>
                  <td className="p-3">app</td>
                  <td className="p-3">cname.vercel-dns.com</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Once configured, click <strong>Verify DNS</strong> in your Vivexa Dashboard. SSL certificate generation starts immediately upon successful DNS resolution.
          </p>
        </section>

        {/* Section 3: Edge Deployment */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Terminal className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">3. Vercel Edge Deployment & Custom Domain Workflow</h2>
          </div>
          <p className="mb-3">
            Every repository imported into Vivexa deploys to Vercel's global edge network:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
            <li>Automatic build detection for Vite, Next.js, React, Astro, Vue, Svelte, and static HTML.</li>
            <li>Instant deployment preview URLs to inspect build outputs before attaching production traffic.</li>
            <li>Zero-downtime custom domain routing: once your deployment is READY, add your custom domain with instant verification.</li>
            <li>Free automatic SSL certificates provisioned via Let's Encrypt at the edge for all connected custom domains.</li>
          </ul>
        </section>

        {/* Section 4: Billing & Invoicing */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">4. Payments & 18% GST Invoicing</h2>
          </div>
          <p className="mb-3">
            Payments are securely processed using Razorpay with 18% Goods and Services Tax (GST) applied to the base subscription price.
          </p>
          <p className="text-xs text-slate-600 mb-2">
            Every successful payment produces an immutable Tax Invoice record formatted as <code className="font-mono font-semibold text-slate-900">VTX-YYYY-XXXXXX</code> detailing:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 mb-4">
            <li>Subtotal amount</li>
            <li>CGST 9% + SGST 9% (or IGST 18%) breakdown</li>
            <li>Customer Name, Email, and GSTIN</li>
            <li>Razorpay Transaction ID & Status</li>
          </ul>
          <p className="text-xs text-slate-500">
            Invoices can be viewed and printed directly from <strong>Dashboard &rarr; Billing</strong>.
          </p>
        </section>
      </div>
    </div>
  );
};
