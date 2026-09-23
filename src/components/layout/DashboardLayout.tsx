import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { planService } from '../../services/plan.service';
import { notificationService } from '../../services/notification.service';
import {
  LayoutDashboard,
  FolderGit2,
  Globe,
  Rocket,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  Bell,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Cloud,
  Plus,
} from 'lucide-react';
import { Plan, NotificationItem } from '../../types';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { path, navigate } = useRouter();
  const { user, profile, signOut, isAdmin } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      planService.getUserUsage(user.uid).then((res) => {
        setCurrentPlan(res.currentPlan);
      });
      notificationService.getUserNotifications(user.uid).then((res) => {
        setNotifications(res);
      });
    }
  }, [user, path]);

  const navItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', path: '/dashboard/projects', icon: FolderGit2 },
    { label: 'Domains', path: '/dashboard/domains', icon: Globe },
    { label: 'Deployments', path: '/dashboard/deployments', icon: Rocket },
    { label: 'Billing & Invoices', path: '/dashboard/billing', icon: CreditCard },
    { label: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = async (notif: NotificationItem) => {
    await notificationService.markAsRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.link) {
      setShowNotifications(false);
      navigate(notif.link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
          <button
            id="dash-logo"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-900 focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              <Cloud className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-extrabold tracking-tight text-slate-900 text-base">
              VIVEXA
            </span>
          </button>
        </div>

        {/* Quick action button */}
        <div className="p-4 border-b border-slate-100">
          <button
            id="dash-new-project-btn"
            onClick={() => navigate('/dashboard/projects/new')}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/dashboard'
                ? path === '/dashboard'
                : path.startsWith(item.path) ||
                  (item.path === '/dashboard/billing' && (path === '/billing' || path === '/subscription'));

            return (
              <button
                key={item.path}
                id={`dash-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <p className="px-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                Administration
              </p>
              <button
                id="dash-nav-admin"
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Admin Console
              </button>
            </div>
          )}
        </nav>

        {/* Current Plan pill */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Subscription
              </span>
              <span
                className={`text-xs font-extrabold ${
                  currentPlan ? 'text-indigo-600' : 'text-amber-700'
                }`}
              >
                {currentPlan ? currentPlan.name : 'No Plan'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2.5">
              {currentPlan ? 'Active Subscription' : 'Payment Required'}
            </p>
            <button
              id="dash-upgrade-plan-btn"
              onClick={() => navigate('/dashboard/billing')}
              className="w-full py-1.5 px-2.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              {currentPlan ? 'Manage / Upgrade' : 'Choose a Plan'}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Vivexa</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 font-semibold capitalize">
              {path.split('/')[2] || 'Overview'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                id="dash-bell-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    <span className="text-[10px] text-slate-400">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-400">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`px-4 py-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                            !n.read ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <p className="font-semibold text-slate-900 mb-0.5">{n.title}</p>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                {profile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {profile?.name || user?.email}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight">
                  {user?.email}
                </span>
              </div>
              <button
                id="dash-signout-btn"
                onClick={signOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content Outlet */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
