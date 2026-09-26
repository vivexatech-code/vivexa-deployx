import type { Metadata } from 'next';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';

export const metadata: Metadata = {
  title: 'Admin Console — Vivexa DeployX',
  description: 'Manage users, subscriptions, invoices, and system resources on Vivexa DeployX.',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  );
}
