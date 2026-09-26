import type { Metadata } from 'next';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const metadata: Metadata = {
  title: 'Dashboard — Vivexa DeployX',
  description: 'Manage your projects, custom domains, deployments, and subscription on Vivexa DeployX.',
};

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}
