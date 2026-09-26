'use client';

import React from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Users,
  Layers,
  Repeat,
  CreditCard,
  FileText,
  FolderGit2,
  Globe,
  Rocket,
  FileCode,
  Sliders,
  ArrowLeft,
  Cloud,
} from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { path, navigate } = useRouter();
  const { user, isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unauthorized Admin Access</h2>
          <p className="text-sm text-slate-600 mb-6">
            You do not have administrator privileges. Only authorized accounts (e.g. vivexatech@gmail.com) can access this console.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Return to User Dashboard
          </button>
        </div>
      </div>
    );
  }

  const adminNav = [
    { label: 'Overview', path: '/admin', icon: ShieldCheck },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Plans & Pricing', path: '/admin/plans', icon: Layers },
    { label: 'Subscriptions', path: '/admin/subscriptions', icon: Repeat },
    { label: 'Payments', path: '/admin/payments', icon: CreditCard },
    { label: 'Tax Invoices', path: '/admin/invoices', icon: FileText },
    { label: 'Projects', path: '/admin/projects', icon: FolderGit2 },
    { label: 'Domains', path: '/admin/domains', icon: Globe },
    { label: 'Deployments', path: '/admin/deployments', icon: Rocket },
    { label: 'System Logs', path: '/admin/logs', icon: FileCode },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-sm block leading-none">
                VIVEXA
              </span>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider">
                ADMIN CONSOLE
              </span>
            </div>
          </div>
        </div>

        {/* Back to User Dashboard */}
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>

        {/* Admin Navigation */}
        <nav className="p-3 space-y-1 flex-1">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/admin' ? path === '/admin' : path.startsWith(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
          Logged in as <span className="text-slate-300 font-semibold">{user?.email}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Administration</span>
            <span>/</span>
            <span className="text-slate-900 capitalize font-bold">
              {path.split('/')[2] || 'Overview'}
            </span>
          </div>
          <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded font-mono font-semibold">
            SuperAdmin Active
          </span>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
