import React, { useEffect, useState } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { planService } from '../../services/plan.service';
import { projectService } from '../../services/project.service';
import { billingService } from '../../services/billing.service';
import { Project, Deployment, PaymentRecord, Plan, Subscription } from '../../types';
import {
  FolderGit2,
  Globe,
  Rocket,
  CreditCard,
  Plus,
  ExternalLink,
  ChevronRight,
  Clock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export const DashboardOverviewView: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();

  const [usage, setUsage] = useState<{
    projectsCount: number;
    domainsCount: number;
    deploymentsCount: number;
    currentPlan: Plan | null;
    subscription: Subscription | null;
    hasActiveSubscription: boolean;
  } | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([
        planService.getUserUsage(user.uid),
        projectService.getUserProjects(user.uid),
        projectService.getUserDeployments(user.uid),
        billingService.getUserPayments(user.uid),
      ]).then(([usageData, projData, depData, payData]) => {
        setUsage(usageData);
        setProjects(projData);
        setDeployments(depData);
        setPayments(payData);
        setLoading(false);
      });
    }
  }, [user]);

  if (loading || !usage) {
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

  const { currentPlan, subscription, hasActiveSubscription } = usage;
  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN')
    : hasActiveSubscription ? 'Monthly cycle' : 'No active cycle';

  return (
    <div className="space-y-8">
      {/* No active subscription callout banner */}
      {!hasActiveSubscription && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">No Active Subscription</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  Payment Required
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Choose a plan to start deploying and hosting your projects with custom domains, automatic SSL, and global edge network.
              </p>
            </div>
          </div>
          <button
            id="overview-activate-plan-banner-btn"
            onClick={() => navigate('/dashboard/billing')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
          >
            Choose a Plan
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor your live websites, edge deployments, quota usage, and billing records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="overview-new-project-btn"
            onClick={() => {
              if (!hasActiveSubscription) {
                navigate('/dashboard/billing');
                return;
              }
              navigate('/dashboard/projects/new');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Quota & Usage Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Plan card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Subscription</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {hasActiveSubscription && currentPlan ? currentPlan.name : 'No Plan'}
            </span>
            <span className="text-xs text-slate-500">
              {hasActiveSubscription && (subscription?.price || currentPlan?.price)
                ? `₹${subscription?.price ?? currentPlan?.price}/mo`
                : 'Inactive'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{hasActiveSubscription ? `Renews: ${renewalDate}` : 'No active plan'}</span>
            <button
              onClick={() => navigate('/dashboard/billing')}
              className="text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              {hasActiveSubscription ? 'Upgrade' : 'Choose Plan'}
            </button>
          </div>
        </div>

        {/* Projects card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Hosted Projects</span>
            <FolderGit2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{usage.projectsCount}</span>
            <span className="text-xs text-slate-400">/ {currentPlan ? currentPlan.maxProjects : 0}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{
                width: currentPlan ? `${Math.min(100, (usage.projectsCount / currentPlan.maxProjects) * 100)}%` : '0%',
              }}
            ></div>
          </div>
        </div>

        {/* Domains card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Custom Domains</span>
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{usage.domainsCount}</span>
            <span className="text-xs text-slate-400">/ {currentPlan ? currentPlan.maxDomains : 0}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: currentPlan ? `${Math.min(100, (usage.domainsCount / currentPlan.maxDomains) * 100)}%` : '0%',
              }}
            ></div>
          </div>
        </div>

        {/* Deployments card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Monthly Builds</span>
            <Rocket className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{usage.deploymentsCount}</span>
            <span className="text-xs text-slate-400">/ {currentPlan ? currentPlan.maxDeployments : 0}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{
                width: currentPlan ? `${Math.min(100, (usage.deploymentsCount / currentPlan.maxDeployments) * 100)}%` : '0%',
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Projects (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Projects</h2>
            <button
              onClick={() => navigate('/dashboard/projects')}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              View all ({projects.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
              <FolderGit2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No projects yet</h3>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                Import your first GitHub repository and deploy your site to the Vercel edge in minutes.
              </p>
              <button
                onClick={() => navigate('/dashboard/projects/new')}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Add Project
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/dashboard/projects/${p.id}`)}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-4 cursor-pointer group shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {p.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'BUILDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600 font-mono truncate">
                      {p.customDomains && p.customDomains.length > 0
                        ? `https://${p.customDomains[0]}`
                        : p.productionUrl
                        ? p.productionUrl
                        : 'No custom domain attached'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {p.branch}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar activity: Recent Deployments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Deployments</h2>
            <button
              onClick={() => navigate('/dashboard/deployments')}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs divide-y divide-slate-100">
            {deployments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No deployments recorded yet.
              </p>
            ) : (
              deployments.slice(0, 5).map((d) => (
                <div key={d.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 truncate">
                      {d.projectName || 'Project'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        d.status === 'READY'
                          ? 'text-emerald-700 bg-emerald-50'
                          : d.status === 'BUILDING'
                          ? 'text-amber-700 bg-amber-50'
                          : 'text-rose-700 bg-rose-50'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mb-1">
                    {d.commitMessage || 'Automated build trigger'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {new Date(d.createdAt).toLocaleDateString()} &bull; {d.branch}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
