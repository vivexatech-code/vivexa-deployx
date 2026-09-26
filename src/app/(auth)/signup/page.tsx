import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SignupView } from '@/views/public/SignupView';

export const metadata: Metadata = {
  title: 'Sign Up — Vivexa Hosting',
  description: 'Create a new Vivexa Hosting account with email or Google authentication.',
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <SignupView />
      </main>
      <Footer />
    </div>
  );
}
