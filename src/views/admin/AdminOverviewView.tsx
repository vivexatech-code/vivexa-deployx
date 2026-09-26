'use client';

import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { useRouter } from '../../context/RouterContext';
import {
  Users,
  CreditCard,
  Rocket,
  Globe,
  TrendingUp,
  AlertTriangle,
  FolderGit2,
  ShieldCheck,
} from 'lucide-react';

export const AdminOverviewView: React.FC = () => {
  const { navigate } = useRouter();
  const [stats, setStats] = useState<{
    totalUsers: number;
    activeSubs: number;
    totalRevenue: number;
    totalPayments: number;
    failedPayments: number;
    totalProjects: number;
    activeDomains: number;
    totalDeployments: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAdminStats().then((res) => {
      setStats(res);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      sub: 'Registered accounts',
      icon: Users,
      color: 'text-indigo-600',
      path: '/admin/users',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubs,
      sub: 'Paid recurring plans',
      icon: TrendingUp,
      color: 'text-emerald-600',
      path: '/admin/subscriptions',
    },
    {
      title: 'Total Revenue',
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      sub: 'Captured via Razorpay',
      icon: CreditCard,
      color: 'text-emerald-600',
      path: '/admin/payments',
    },
    {
      title: 'Total Deployments',
      value: stats.totalDeployments,
      sub: 'Vercel edge builds',
      icon: Rocket,
      color: 'text-indigo-600',
      path: '/admin/deployments',
    },
    {
      title: 'Hosted Projects',
      value: stats.totalProjects,
      sub: 'Active repositories',
      icon: FolderGit2,
      color: 'text-amber-600',
      path: '/admin/projects',
    },
    {
      title: 'Active Domains',
      value: stats.activeDomains,
      sub: 'Subdomains & custom DNS',
      icon: Globe,
      color: 'text-indigo-600',
      path: '/admin/domains',
    },
    {
      title: 'Failed Payments',
      value: stats.failedPayments,
      sub: 'Payment failures logged',
      icon: AlertTriangle,
      color: 'text-rose-600',
      path: '/admin/payments',
    },
    {
      title: 'Tax Compliance',
      value: '18% GST',
      sub: 'Itemized on all invoices',
      icon: ShieldCheck,
      color: 'text-indigo-600',
      path: '/admin/invoices',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          System Overview & Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time metrics for Vivexa DeployX infrastructure, users, revenue, and deployments.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(c.path)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>{c.title}</span>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                {c.value}
              </div>
              <p className="text-[11px] text-slate-400">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/admin/users')}
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer shadow-2xs"
        >
          <h3 className="font-bold text-sm text-slate-900 mb-1">User Management</h3>
          <p className="text-xs text-slate-500">
            Search registered users, view profile details, and elevate/revoke admin roles.
          </p>
        </div>

        <div
          onClick={() => navigate('/admin/plans')}
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer shadow-2xs"
        >
          <h3 className="font-bold text-sm text-slate-900 mb-1">Plans & Pricing</h3>
          <p className="text-xs text-slate-500">
            Adjust prices in INR, modify plan limits (projects, domains, bandwidth), and save to Firestore.
          </p>
        </div>

        <div
          onClick={() => navigate('/admin/invoices')}
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer shadow-2xs"
        >
          <h3 className="font-bold text-sm text-slate-900 mb-1">Tax Invoicing</h3>
          <p className="text-xs text-slate-500">
            Inspect all 18% GST tax invoices generated by user subscription checkouts.
          </p>
        </div>
      </div>
    </div>
  );
};
