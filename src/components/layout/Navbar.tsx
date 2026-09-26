'use client';

import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Cloud, ArrowRight, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { path, navigate } = useRouter();
  const { user, profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          id="nav-brand-logo"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-slate-900 focus:outline-none group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-indigo-600 transition-colors">
            <Cloud className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold tracking-tight text-slate-900 text-base leading-none">
              VIVEXA
            </span>
            <span className="text-[10px] tracking-widest text-slate-500 font-semibold uppercase mt-0.5">
              DEPLOYX
            </span>
          </div>
        </button>

        {/* Public Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            id="nav-link-features"
            onClick={() => navigate('/features')}
            className={`text-sm font-medium transition-colors cursor-pointer ${
              path === '/features' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Features
          </button>
          <button
            id="nav-link-pricing"
            onClick={() => navigate('/pricing')}
            className={`text-sm font-medium transition-colors cursor-pointer ${
              path === '/pricing' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pricing
          </button>
          <button
            id="nav-link-docs"
            onClick={() => navigate('/docs')}
            className={`text-sm font-medium transition-colors cursor-pointer ${
              path === '/docs' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Docs
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {profile?.role === 'admin' && (
                <button
                  id="nav-btn-admin"
                  onClick={() => navigate('/admin')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Admin
                </button>
              )}
              <button
                id="nav-btn-dashboard"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                id="nav-btn-login"
                onClick={() => navigate('/login')}
                className="px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="nav-btn-signup"
                onClick={() => navigate('/signup')}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
              >
                Start Hosting
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
