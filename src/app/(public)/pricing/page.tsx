import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { PricingView } from '@/views/public/PricingView';

export const metadata: Metadata = {
  title: 'Pricing — Vivexa Hosting',
  description: 'Simple, transparent hosting plans with full Razorpay billing and GST compliance.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <PricingView />
      </main>
      <Footer />
    </div>
  );
}
