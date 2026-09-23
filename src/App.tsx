/**
 * Vivexa Hosting - Main Application Entrypoint
 * Orchestrates client-side routing, authentication state, and layouts.
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';

// Layouts
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Public Views
import { HomeView } from './views/public/HomeView';
import { PricingView } from './views/public/PricingView';
import { FeaturesView } from './views/public/FeaturesView';
import { DocsView } from './views/public/DocsView';
import { LoginView } from './views/public/LoginView';
import { SignupView } from './views/public/SignupView';

// Dashboard Views
import { DashboardOverviewView } from './views/dashboard/DashboardOverviewView';
import { ProjectsListView } from './views/dashboard/ProjectsListView';
import { NewProjectView } from './views/dashboard/NewProjectView';
import { ProjectDetailView } from './views/dashboard/ProjectDetailView';
import { DomainsView } from './views/dashboard/DomainsView';
import { DeploymentsView } from './views/dashboard/DeploymentsView';
import { BillingView } from './views/dashboard/BillingView';
import { SettingsView } from './views/dashboard/SettingsView';

// Admin Views
import { AdminOverviewView } from './views/admin/AdminOverviewView';
import { AdminUsersView } from './views/admin/AdminUsersView';
import { AdminPlansView } from './views/admin/AdminPlansView';
import { AdminSubscriptionsView } from './views/admin/AdminSubscriptionsView';
import { AdminPaymentsView } from './views/admin/AdminPaymentsView';
import { AdminInvoicesView } from './views/admin/AdminInvoicesView';
import { AdminProjectsView } from './views/admin/AdminProjectsView';
import { AdminDomainsView } from './views/admin/AdminDomainsView';
import { AdminDeploymentsView } from './views/admin/AdminDeploymentsView';
import { AdminLogsView } from './views/admin/AdminLogsView';

const AppRoutes: React.FC = () => {
  const { path, params, navigate } = useRouter();
  const { user, loading } = useAuth();

  // If loading auth state, show a subtle loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-indigo-600 animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500">
            Initializing Vivexa Hosting...
          </span>
        </div>
      </div>
    );
  }

  // Protected Route Guard for Dashboard & Billing
  if ((path.startsWith('/dashboard') || path === '/billing' || path === '/subscription') && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1">
          <LoginView />
        </main>
        <Footer />
      </div>
    );
  }

  // --- ADMIN ROUTES ---
  if (path.startsWith('/admin')) {
    return (
      <AdminLayout>
        {path === '/admin' && <AdminOverviewView />}
        {path === '/admin/users' && <AdminUsersView />}
        {path === '/admin/plans' && <AdminPlansView />}
        {path === '/admin/subscriptions' && <AdminSubscriptionsView />}
        {path === '/admin/payments' && <AdminPaymentsView />}
        {path === '/admin/invoices' && <AdminInvoicesView />}
        {path === '/admin/projects' && <AdminProjectsView />}
        {path === '/admin/domains' && <AdminDomainsView />}
        {path === '/admin/deployments' && <AdminDeploymentsView />}
        {path === '/admin/logs' && <AdminLogsView />}
      </AdminLayout>
    );
  }

  // --- USER DASHBOARD ROUTES ---
  if (path.startsWith('/dashboard') || path === '/billing' || path === '/subscription') {
    return (
      <DashboardLayout>
        {path === '/dashboard' && <DashboardOverviewView />}
        {path === '/dashboard/projects' && <ProjectsListView />}
        {path === '/dashboard/projects/new' && <NewProjectView />}
        {Boolean(params.projectId) && <ProjectDetailView />}
        {path === '/dashboard/domains' && <DomainsView />}
        {path === '/dashboard/deployments' && <DeploymentsView />}
        {(path === '/dashboard/billing' || path === '/billing' || path === '/subscription') && <BillingView />}
        {path === '/dashboard/settings' && <SettingsView />}
      </DashboardLayout>
    );
  }

  // --- PUBLIC ROUTES ---
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        {path === '/' && <HomeView />}
        {path === '/pricing' && <PricingView />}
        {path === '/features' && <FeaturesView />}
        {path === '/docs' && <DocsView />}
        {path === '/login' && <LoginView />}
        {path === '/signup' && <SignupView />}
        {/* 404 Fallback */}
        {path !== '/' &&
          path !== '/pricing' &&
          path !== '/features' &&
          path !== '/docs' &&
          path !== '/login' &&
          path !== '/signup' && (
            <div className="py-24 px-4 text-center">
              <h1 className="text-4xl font-extrabold text-slate-900 mb-2">404</h1>
              <p className="text-sm text-slate-600 mb-6">Page not found</p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                Back to Home
              </button>
            </div>
          )}
      </main>
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <AppRoutes />
      </RouterProvider>
    </AuthProvider>
  );
}
