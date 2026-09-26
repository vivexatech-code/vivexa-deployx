import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LoginView } from '@/views/public/LoginView';

export const metadata: Metadata = {
  title: 'Sign In — Vivexa DeployX',
  description: 'Log in to your Vivexa DeployX dashboard with email or Google authentication.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <LoginView />
      </main>
      <Footer />
    </div>
  );
}
