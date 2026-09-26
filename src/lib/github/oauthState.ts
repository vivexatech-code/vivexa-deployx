import crypto from 'crypto';
import { NextRequest } from 'next/server';

export interface OAuthStatePayload {
  userId: string;
  origin: string;
  nonce: string;
  exp: number;
}

const SAFE_ORIGIN = /^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/;

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET or GITHUB_CLIENT_SECRET is required to sign OAuth state.');
  }
  return secret;
}

export function isSafeOrigin(origin: string): boolean {
  return SAFE_ORIGIN.test(origin);
}

export function resolveOAuthOrigin(req: NextRequest, requested: string | null): string {
  const requestOrigin = req.nextUrl.origin;
  const configured = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => {
      try {
        const withProtocol = value.includes('://') ? value : `https://${value}`;
        return new URL(withProtocol).origin;
      } catch {
        return '';
      }
    })
    .filter((origin) => isSafeOrigin(origin));

  // Always allow the live request origin for this deployment.
  if (requested && isSafeOrigin(requested)) {
    if (
      requested === requestOrigin ||
      configured.includes(requested) ||
      requested.endsWith('.vivexatech.in') ||
      requested.endsWith('.vercel.app')
    ) {
      return requested;
    }
  }

  return requestOrigin;
}

export function signOAuthState(userId: string, origin: string): string {
  const payload: OAuthStatePayload = {
    userId,
    origin,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  let expected = '';
  try {
    expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  } catch {
    return null;
  }

  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!decoded.userId || !decoded.origin || !decoded.exp || !decoded.nonce) return null;
    if (!isSafeOrigin(decoded.origin)) return null;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
