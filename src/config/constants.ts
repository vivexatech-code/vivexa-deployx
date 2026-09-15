/**
 * Vivexa Hosting Constants
 */

import { Plan } from '../types';

export const APP_NAME = 'Vivexa Hosting';
export const ROOT_DOMAIN = 'vivexatech.in';
export const GST_RATE = 0.18; // 18% standard GST in India

// Reserved subdomains to prevent collisions with critical infrastructure
export const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'dashboard',
  'mail',
  'www',
  'support',
  'billing',
  'login',
  'signup',
  'app',
  'cdn',
  'auth',
  'ns1',
  'ns2',
  'status',
  'docs',
  'blog',
  'internal',
  'staging',
  'test',
  'demo',
  'root',
  'webmail',
  'secure',
  'assets',
]);

// Default 3 Subscription Plans (Dynamically customizable in Firestore)
export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    description: 'Perfect for hobby projects, portfolios, and individual developers launching fast.',
    price: 499, // ₹499/month
    billingCycle: 'monthly',
    gstRate: GST_RATE,
    maxProjects: 3,
    maxDomains: 1,
    maxSubdomains: 3,
    maxDeployments: 100,
    storageLimit: '1 GB',
    bandwidthLimit: '50 GB / mo',
    teamMembers: 1,
    features: [
      '3 Live Hosted Projects',
      '1 Custom Domain connection',
      '3 Free *.vivexatech.in subdomains',
      'Automated GitHub Deployments',
      'Global Vercel Edge Network',
      'Automatic Free SSL Certificates',
      'Community Support',
    ],
    active: true,
    highlight: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    description: 'Designed for high-growth creators, startups, and agencies managing production apps.',
    price: 1499, // ₹1,499/month
    billingCycle: 'monthly',
    gstRate: GST_RATE,
    maxProjects: 10,
    maxDomains: 5,
    maxSubdomains: 10,
    maxDeployments: 500,
    storageLimit: '10 GB',
    bandwidthLimit: '250 GB / mo',
    teamMembers: 3,
    features: [
      '10 Live Hosted Projects',
      '5 Custom Domains with Instant DNS Verify',
      '10 Free *.vivexatech.in subdomains',
      'Automated Git Webhook deployments',
      'High-performance Vercel Edge CDN',
      'Custom Environment Variables',
      'Priority Build Queue',
      'Standard Priority Support',
    ],
    active: true,
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_business',
    name: 'Business',
    description: 'Full-scale power for businesses requiring enterprise reliability, multi-domain fleets, and SLA.',
    price: 3999, // ₹3,999/month
    billingCycle: 'monthly',
    gstRate: GST_RATE,
    maxProjects: 50,
    maxDomains: 25,
    maxSubdomains: 50,
    maxDeployments: 2500,
    storageLimit: '50 GB',
    bandwidthLimit: '1 TB / mo',
    teamMembers: 10,
    features: [
      '50 Live Hosted Projects',
      '25 Custom Domains connection',
      '50 Free *.vivexatech.in subdomains',
      'Unlimited Instant Redeployments',
      'Enterprise Edge Caching & Routing',
      'Full Environment Variable Secrets Vault',
      'Audit Logs & Compliance Reports',
      '24/7 Dedicated Priority SLA Support',
    ],
    active: true,
    highlight: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const FRAMEWORK_PRESETS = [
  {
    id: 'nextjs',
    name: 'Next.js',
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    installCommand: 'npm install',
    icon: 'Terminal',
  },
  {
    id: 'vite',
    name: 'Vite / React',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
    icon: 'Zap',
  },
  {
    id: 'vue',
    name: 'Vue.js',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
    icon: 'Code2',
  },
  {
    id: 'astro',
    name: 'Astro',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
    icon: 'Rocket',
  },
  {
    id: 'remix',
    name: 'Remix',
    buildCommand: 'npm run build',
    outputDirectory: 'build',
    installCommand: 'npm install',
    icon: 'Layers',
  },
  {
    id: 'static',
    name: 'HTML / Static',
    buildCommand: '',
    outputDirectory: 'public',
    installCommand: '',
    icon: 'FileCode',
  },
];
