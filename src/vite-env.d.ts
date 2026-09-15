/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_VERCEL_API_TOKEN?: string;
  readonly VITE_VERCEL_TEAM_ID?: string;
  readonly VITE_GITHUB_CLIENT_ID?: string;
  readonly VITE_GITHUB_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
