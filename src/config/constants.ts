/**
 * Vivexa DeployX Constants
 */

import { Plan } from '../types';

export const APP_NAME = 'Vivexa DeployX';
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
