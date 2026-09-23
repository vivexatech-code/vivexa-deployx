import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { billingRouter } from './server/routes/billingRoutes';
import { hostingRouter } from './server/routes/hostingRoutes';
import { VercelService } from './server/vercelService';
import { RazorpayService } from './server/razorpayService';
import { tokenStore } from './server/tokenStore';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Mount Modular API Routers
app.use('/api/billing', billingRouter);
app.use('/api/hosting', hostingRouter);

// Secure server-side token store proxy
// Tokens are NEVER sent to the client browser or stored in client-readable documents
const serverTokenStore: Record<string, any> = new Proxy({}, {
  get(_target, prop: string) {
    return tokenStore.getToken(prop);
  },
  set(_target, prop: string, value: any) {
    tokenStore.saveToken(prop, value);
    return true;
  },
  deleteProperty(_target, prop: string) {
    tokenStore.deleteToken(prop);
    return true;
  },
});

function saveTokenStore() {
  // handled automatically by tokenStore
}

// Helper to extract authenticated userId from headers, Authorization, or query
function getRequestUserId(req: express.Request): string | null {
  const headerUid = req.headers['x-user-id'] as string;
  if (headerUid) return headerUid.trim();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && !token.includes('.')) {
      return token;
    }
    // If it's a JWT, parse the payload to extract user_id / sub without throwing
    if (token && token.split('.').length === 3) {
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (payload.user_id || payload.sub) {
          return payload.user_id || payload.sub;
        }
      } catch {}
    }
  }
  return (req.query.userId as string) || (req.body?.userId as string) || null;
}

// ---------------------------------------------------------------------------
// 1. API Health Check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    githubOAuthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    vercelConfigured: VercelService.isConfigured(),
    razorpayConfigured: RazorpayService.isConfigured(),
  });
});

// ---------------------------------------------------------------------------
// 2. GitHub OAuth Config & Status
// ---------------------------------------------------------------------------
app.get('/api/github/config', (req, res) => {
  const isConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  res.json({
    configured: isConfigured,
    clientId: process.env.GITHUB_CLIENT_ID || null,
  });
});

// ---------------------------------------------------------------------------
// 3. Initiate GitHub OAuth Connection
// Returns the official GitHub authorization URL
// ---------------------------------------------------------------------------
app.get('/api/github/connect', (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) {
    res.status(400).json({ error: 'User ID is required to connect GitHub' });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  // Determine callback URL
  const reqOrigin = req.query.origin as string;
  const fallbackOrigin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const origin = reqOrigin || fallbackOrigin;
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || `${origin}/api/github/callback`;

  // Encode state with userId and expiration (10 min) to prevent CSRF
  const statePayload = {
    userId,
    origin,
    nonce: Math.random().toString(36).substring(2, 15),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  if (!clientId || !clientSecret) {
    // When environment variables are not yet configured, provide demo callback URL and explanation
    const demoUrl = `/api/github/demo-callback?userId=${encodeURIComponent(userId)}&origin=${encodeURIComponent(origin)}`;
    res.json({
      configured: false,
      url: demoUrl,
      message: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set in environment variables. You can add them in AI Studio Settings or test with preview simulation.',
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'repo,read:user,user:email',
    state,
    allow_signup: 'true',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({
    configured: true,
    url: authUrl,
    callbackUrl,
  });
});

// ---------------------------------------------------------------------------
// 4. GitHub OAuth Callback (Server-side code exchange)
// ---------------------------------------------------------------------------
app.get('/api/github/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle authorization rejection or errors from GitHub
  if (error) {
    const errorMsg = (error_description as string) || (error as string) || 'GitHub authorization was canceled or failed.';
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connection Failed</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a;">
          <div style="background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✕</div>
            <h2 style="font-size: 18px; margin: 0 0 8px; font-weight: 700;">GitHub Authorization Canceled</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 24px; line-height: 1.5;">${escapeHtml(errorMsg)}</p>
            <button onclick="window.close()" style="background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: ${JSON.stringify(errorMsg)} }, '*');
              setTimeout(() => window.close(), 2500);
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  if (!code || !state) {
    res.status(400).send('Missing code or state parameter');
    return;
  }

  // Validate state
  let stateData: any;
  try {
    stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString('utf-8'));
    if (!stateData.userId || !stateData.exp || stateData.exp < Date.now()) {
      throw new Error('OAuth state expired or invalid');
    }
  } catch (err: any) {
    res.status(400).send(`Invalid OAuth state: ${err.message}`);
    return;
  }

  const userId = stateData.userId;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).send('GitHub OAuth credentials are not configured on server');
    return;
  }

  try {
    // 1. Exchange authorization code for access token with GitHub
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: HTTP ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error('No access token received from GitHub');
    }

    // 2. Fetch authenticated GitHub user identity
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Vivexa-Hosting-Platform',
      },
    });

    if (!userRes.ok) {
      throw new Error(`Failed to fetch GitHub profile: HTTP ${userRes.status}`);
    }

    const ghUser = await userRes.json();
    const githubUsername = ghUser.login;
    const githubAvatar = ghUser.avatar_url || '';
    const githubUserId = String(ghUser.id);

    // 3. Store OAuth credentials securely on server only
    serverTokenStore[userId] = {
      token: accessToken,
      username: githubUsername,
      avatarUrl: githubAvatar,
      connectedAt: new Date().toISOString(),
    };
    saveTokenStore();

    // 4. Send success message to opener window and close popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connected</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a;">
          <div style="background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
            <h2 style="font-size: 18px; margin: 0 0 8px; font-weight: 700;">GitHub Connected!</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">Authenticated as <strong>@${escapeHtml(githubUsername)}</strong></p>
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">This window will close automatically...</p>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GITHUB_OAUTH_SUCCESS',
                  userId: ${JSON.stringify(userId)},
                  username: ${JSON.stringify(githubUsername)},
                  avatarUrl: ${JSON.stringify(githubAvatar)},
                  githubUserId: ${JSON.stringify(githubUserId)}
                }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/dashboard/projects/new?connected=true';
              }
            } catch (e) {
              window.location.href = '/dashboard/projects/new?connected=true';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connection Error</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a;">
          <div style="background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✕</div>
            <h2 style="font-size: 18px; margin: 0 0 8px; font-weight: 700;">Connection Failed</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 24px;">${escapeHtml(err.message || 'Failed to exchange authorization code.')}</p>
            <button onclick="window.close()" style="background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Close</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: ${JSON.stringify(err.message)} }, '*');
            }
          </script>
        </body>
      </html>
    `);
  }
});

// ---------------------------------------------------------------------------
// 5. Demo / Simulation Callback for sandbox testing when credentials not set
// ---------------------------------------------------------------------------
app.get('/api/github/demo-callback', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).send('User ID required');
    return;
  }

  const demoUsername = 'vivexa-developer';
  const demoAvatar = 'https://avatars.githubusercontent.com/u/9919?s=200&v=4';

  serverTokenStore[userId] = {
    token: 'demo_simulated_token',
    username: demoUsername,
    avatarUrl: demoAvatar,
    connectedAt: new Date().toISOString(),
  };
  saveTokenStore();

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>GitHub Connected (Preview Simulation)</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a;">
        <div style="background: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
          <h2 style="font-size: 18px; margin: 0 0 8px; font-weight: 700;">GitHub Connected!</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">Authenticated as <strong>@${demoUsername}</strong></p>
          <p style="font-size: 11px; color: #94a3b8; margin: 0 0 16px;">(Preview simulation enabled while GITHUB_CLIENT_ID is unconfigured)</p>
          <button onclick="window.close()" style="background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Complete & Return</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GITHUB_OAUTH_SUCCESS',
              userId: ${JSON.stringify(userId)},
              username: ${JSON.stringify(demoUsername)},
              avatarUrl: ${JSON.stringify(demoAvatar)},
              githubUserId: '9919'
            }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            window.location.href = '/dashboard/projects/new?connected=true';
          }
        </script>
      </body>
    </html>
  `);
});

// ---------------------------------------------------------------------------
// 6. Check GitHub Connection Status for Authenticated User
// ---------------------------------------------------------------------------
app.get('/api/github/connection', (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  const record = serverTokenStore[userId];
  if (!record || !record.token) {
    res.json({ connected: false });
    return;
  }

  res.json({
    connected: true,
    username: record.username,
    avatarUrl: record.avatarUrl,
    connectedAt: record.connectedAt,
  });
});

// ---------------------------------------------------------------------------
// 7. Disconnect GitHub Account
// Clears stored credentials and terminates active session
// ---------------------------------------------------------------------------
app.post('/api/github/disconnect', (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  delete serverTokenStore[userId];
  saveTokenStore();

  res.json({ success: true, message: 'GitHub account disconnected successfully' });
});

// ---------------------------------------------------------------------------
// 8. Fetch User Repositories (Server-side API call using secure token)
// Supports search, private/public repos, pagination
// ---------------------------------------------------------------------------
app.get('/api/github/repos', async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const record = serverTokenStore[userId];
  if (!record || !record.token) {
    res.status(403).json({ error: 'GitHub account is not connected. Connect GitHub to import repositories.' });
    return;
  }

  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const page = parseInt((req.query.page as string) || '1', 10);
  const perPage = parseInt((req.query.per_page as string) || '30', 10);

  // If using demo simulated connection
  if (record.token === 'demo_simulated_token') {
    const demoRepos = [
      {
        id: 101,
        name: 'vivexa-saas-dashboard',
        full_name: `${record.username}/vivexa-saas-dashboard`,
        owner: { login: record.username, avatar_url: record.avatarUrl },
        html_url: `https://github.com/${record.username}/vivexa-saas-dashboard`,
        description: 'Modern Next.js 14 SaaS customer dashboard with Tailwind CSS',
        default_branch: 'main',
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        private: false,
        language: 'TypeScript',
      },
      {
        id: 102,
        name: 'ecommerce-storefront',
        full_name: `${record.username}/ecommerce-storefront`,
        owner: { login: record.username, avatar_url: record.avatarUrl },
        html_url: `https://github.com/${record.username}/ecommerce-storefront`,
        description: 'High-performance headless e-commerce store built with Vite + React',
        default_branch: 'main',
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        private: true,
        language: 'TypeScript',
      },
      {
        id: 103,
        name: 'company-docs-astro',
        full_name: `${record.username}/company-docs-astro`,
        owner: { login: record.username, avatar_url: record.avatarUrl },
        html_url: `https://github.com/${record.username}/company-docs-astro`,
        description: 'Lightweight static documentation portal built with Astro Starlight',
        default_branch: 'main',
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        private: false,
        language: 'Astro',
      },
      {
        id: 104,
        name: 'mobile-api-service',
        full_name: `${record.username}/mobile-api-service`,
        owner: { login: record.username, avatar_url: record.avatarUrl },
        html_url: `https://github.com/${record.username}/mobile-api-service`,
        description: 'Microservice backend with Express and PostgreSQL',
        default_branch: 'master',
        updated_at: new Date(Date.now() - 172800000).toISOString(),
        private: true,
        language: 'TypeScript',
      },
      {
        id: 105,
        name: 'portfolio-website',
        full_name: `${record.username}/portfolio-website`,
        owner: { login: record.username, avatar_url: record.avatarUrl },
        html_url: `https://github.com/${record.username}/portfolio-website`,
        description: 'Personal design portfolio and engineering blog',
        default_branch: 'main',
        updated_at: new Date(Date.now() - 259200000).toISOString(),
        private: false,
        language: 'JavaScript',
      },
    ];

    let filtered = demoRepos;
    if (search) {
      filtered = demoRepos.filter(
        (r) => r.name.toLowerCase().includes(search) || (r.description && r.description.toLowerCase().includes(search))
      );
    }
    res.json(filtered);
    return;
  }

  // Real GitHub API call
  try {
    const ghRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
      headers: {
        Authorization: `Bearer ${record.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Vivexa-Hosting-Platform',
      },
    });

    if (!ghRes.ok) {
      if (ghRes.status === 401) {
        delete serverTokenStore[userId];
        saveTokenStore();
        res.status(401).json({ error: 'GitHub access was revoked or expired. Please reconnect GitHub.' });
        return;
      }
      if (ghRes.status === 403) {
        res.status(403).json({ error: 'GitHub API rate limit exceeded. Please wait a moment and try again.' });
        return;
      }
      throw new Error(`GitHub API error: HTTP ${ghRes.status}`);
    }

    const repos = await ghRes.json();
    let sanitized = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: {
        login: r.owner?.login || '',
        avatar_url: r.owner?.avatar_url || '',
      },
      html_url: r.html_url,
      description: r.description,
      default_branch: r.default_branch || 'main',
      updated_at: r.updated_at,
      private: Boolean(r.private),
      language: r.language,
    }));

    if (search) {
      sanitized = sanitized.filter(
        (r: any) => r.name.toLowerCase().includes(search) || (r.description && r.description.toLowerCase().includes(search))
      );
    }

    res.json(sanitized);
  } catch (err: any) {
    console.error('Failed to fetch repositories:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch repositories from GitHub' });
  }
});

// ---------------------------------------------------------------------------
// 9. Fetch Repository Branches
// ---------------------------------------------------------------------------
app.get('/api/github/branches', async (req, res) => {
  const userId = getRequestUserId(req);
  const owner = req.query.owner as string;
  const repo = req.query.repo as string;

  if (!userId || !owner || !repo) {
    res.status(400).json({ error: 'Missing userId, owner, or repo' });
    return;
  }

  const record = serverTokenStore[userId];
  if (!record || !record.token) {
    res.status(403).json({ error: 'GitHub account is not connected' });
    return;
  }

  if (record.token === 'demo_simulated_token') {
    res.json([
      { name: 'main', commit: { sha: '7f9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a' } },
      { name: 'staging', commit: { sha: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b' } },
      { name: 'development', commit: { sha: '5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e' } },
    ]);
    return;
  }

  try {
    const bRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`, {
      headers: {
        Authorization: `Bearer ${record.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Vivexa-Hosting-Platform',
      },
    });

    if (!bRes.ok) {
      throw new Error(`Failed to fetch branches: HTTP ${bRes.status}`);
    }

    const branches = await bRes.json();
    res.json(
      branches.map((b: any) => ({
        name: b.name,
        commit: { sha: b.commit?.sha || '' },
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch branches' });
  }
});

// ---------------------------------------------------------------------------
// 10. Detect Framework from repository package.json
// ---------------------------------------------------------------------------
app.get('/api/github/detect-framework', async (req, res) => {
  const userId = getRequestUserId(req);
  const owner = req.query.owner as string;
  const repo = req.query.repo as string;

  if (!userId || !owner || !repo) {
    res.json({ framework: 'vite' });
    return;
  }

  const record = serverTokenStore[userId];
  if (!record || !record.token || record.token === 'demo_simulated_token') {
    if (repo.includes('next')) {
      res.json({ framework: 'nextjs' });
      return;
    }
    if (repo.includes('astro')) {
      res.json({ framework: 'astro' });
      return;
    }
    res.json({ framework: 'vite' });
    return;
  }

  try {
    const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
      headers: {
        Authorization: `Bearer ${record.token}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'Vivexa-Hosting-Platform',
      },
    });

    if (pkgRes.ok) {
      const pkg = await pkgRes.json();
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps['next']) {
        res.json({ framework: 'nextjs' });
        return;
      }
      if (deps['astro']) {
        res.json({ framework: 'astro' });
        return;
      }
      if (deps['@remix-run/react']) {
        res.json({ framework: 'remix' });
        return;
      }
      if (deps['vue']) {
        res.json({ framework: 'vue' });
        return;
      }
      if (deps['svelte'] || deps['@sveltejs/kit']) {
        res.json({ framework: 'svelte' });
        return;
      }
      if (deps['vite']) {
        res.json({ framework: 'vite' });
        return;
      }
      if (deps['react']) {
        res.json({ framework: 'vite' });
        return;
      }
    }
  } catch {
    // Fallback
  }

  res.json({ framework: 'vite' });
});

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// 11. Vite Dev Middleware / Static Production Assets
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vivexa server running on port ${PORT}`);
    // Run legacy subdomain database cleanup in background
    import('./server/migration')
      .then((m) => m.purgeLegacySubdomains())
      .catch((err) => console.warn('[Migration notice]', err?.message || err));
  });
}

startServer();
