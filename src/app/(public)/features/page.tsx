import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { FeaturesView } from '@/views/public/FeaturesView';

export const metadata: Metadata = {
  title: 'Features — Vivexa DeployX',
  description: 'Automated GitHub deployments, global Vercel edge network, SSL certificates, and custom domains.',
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <FeaturesView />
      </main>
      <Footer />
    </div>
  );
}
