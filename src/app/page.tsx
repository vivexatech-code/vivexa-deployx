import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HomeView } from '@/views/public/HomeView';

export const metadata: Metadata = {
  title: 'Vivexa DeployX — Simple Hosting for Modern Websites',
  description:
    'Deploy web projects instantly from GitHub with automated builds, custom domains, and Vercel edge infrastructure.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <HomeView />
      </main>
      <Footer />
    </div>
  );
}
