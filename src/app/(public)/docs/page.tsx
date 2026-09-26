import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { DocsView } from '@/views/public/DocsView';

export const metadata: Metadata = {
  title: 'Documentation — Vivexa DeployX',
  description: 'Learn how to deploy your projects, connect custom domains, and configure DNS on Vivexa DeployX.',
};

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <DocsView />
      </main>
      <Footer />
    </div>
  );
}
