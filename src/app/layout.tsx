import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'Vivexa DeployX — Simple Hosting for Modern Websites',
  description:
    'Subscription-based hosting platform providing automated GitHub deployments, Vercel edge infrastructure, custom domains, and Razorpay billing.',
  openGraph: {
    title: 'Vivexa DeployX — Simple Hosting for Modern Websites',
    description:
      'Subscription-based hosting platform providing automated GitHub deployments, Vercel edge infrastructure, custom domains, and Razorpay billing.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vivexa DeployX — Simple Hosting for Modern Websites',
    description:
      'Subscription-based hosting platform providing automated GitHub deployments, Vercel edge infrastructure, custom domains, and Razorpay billing.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <ClientProviders>{children}</ClientProviders>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
