'use client';

import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { Cloud, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                <Cloud className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-extrabold tracking-tight text-slate-900 text-base">
                VIVEXA HOSTING
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Modern developer hosting platform. Automatic GitHub deployments, Vercel edge network, branded custom domain routing, and 18% GST tax invoicing.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/features')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  Platform Features
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/pricing')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  Pricing & 18% GST
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/docs')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  Documentation
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Developers</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/docs')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  GitHub Integration
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/docs')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  DNS & Custom Domains
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/docs')} className="text-slate-600 hover:text-slate-900 cursor-pointer">
                  Vercel Infrastructure
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Legal & Support</h4>
            <p className="text-xs text-slate-500 mb-2">
              GST Registration: 29AAAAA0000A1Z5
            </p>
            <p className="text-xs text-slate-500 mb-2">
              Support: vivexatech@gmail.com
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All edge systems operational
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Vivexa Hosting (vivexatech.in). All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for modern creators and enterprises.
          </p>
        </div>
      </div>
    </footer>
  );
};
