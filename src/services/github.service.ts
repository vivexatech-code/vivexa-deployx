/**
 * GitHub Integration Service
 * Real GitHub OAuth integration, repository importing, branch fetching, and framework detection.
 * All sensitive tokens remain securely server-side.
 */

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GitHubRepo, GitHubBranch, GitHubConnection } from '../types';
import { FRAMEWORK_PRESETS } from '../config/constants';
import { getAuthHeaders } from './apiClient';

function asList(data: unknown, key: 'repos' | 'branches'): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function toGitHubRepo(raw: any): GitHubRepo {
  return {
    id: Number(raw?.id),
    name: raw?.name || '',
    full_name: raw?.full_name || raw?.fullName || '',
    owner: {
      login: raw?.owner?.login || '',
      avatar_url: raw?.owner?.avatar_url || raw?.owner?.avatarUrl || '',
    },
    html_url: raw?.html_url || raw?.htmlUrl || '',
    description: raw?.description ?? null,
    default_branch: raw?.default_branch || raw?.defaultBranch || 'main',
    updated_at: raw?.updated_at || raw?.updatedAt || '',
    private: Boolean(raw?.private ?? raw?.isPrivate),
    language: raw?.language ?? null,
  };
}

function toGitHubBranch(raw: any): GitHubBranch {
  return {
    name: raw?.name || '',
    commit: {
      sha: raw?.commit?.sha || raw?.commitSha || '',
    },
  };
}

export interface RepoInspectionResult {
  success: boolean;
  detectedFramework: string | null;
  frameworkName: string;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  hasPackageJson: boolean;
  isStatic: boolean;
  rootDirectory: string;
  rootDirectoryValid: boolean;
  candidateRootDirectories: string[];
  availableScripts: string[];
  error?: string;
}

export const githubService = {
  /**
   * Check if user has an active GitHub connection
   */
  async getGitHubConnection(userId: string): Promise<GitHubConnection | null> {
    if (!userId) return null;

    try {
      // 1. Check client Firestore document
      const snap = await getDoc(doc(db, 'githubConnections', userId));
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: userId,
          userId,
          githubUsername: data.githubUsername || data.username || 'Connected',
          githubAvatar: data.githubAvatar || data.avatarUrl || '',
          githubUserId: data.githubUserId || '',
          provider: 'github',
          connectedAt: data.connectedAt || new Date().toISOString(),
        };
      }

      // 2. Fallback check with server-side connection endpoint
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/github/connection', { headers: authHeaders });
      if (res.ok) {
        const serverConn = await res.json();
        if (serverConn.connected) {
          const connObj: GitHubConnection = {
            id: userId,
            userId,
            githubUsername: serverConn.username || 'Connected',
            githubAvatar: serverConn.avatarUrl || '',
            githubUserId: serverConn.githubUserId || '',
            provider: 'github',
            connectedAt: serverConn.connectedAt || new Date().toISOString(),
          };

          // Cache in Firestore
          await setDoc(doc(db, 'githubConnections', userId), connObj, { merge: true });
          return connObj;
        }
      }

      return null;
    } catch (err) {
      console.warn('Error fetching GitHub connection:', err);
      return null;
    }
  },

  /**
   * Initiate GitHub OAuth Popup Flow
   * Opens GitHub's official authorization dialog in a dedicated popup window
   */
  async initiateOAuthConnect(userId: string): Promise<{ success: boolean; username: string; avatarUrl?: string }> {
    if (!userId) {
      throw new Error('You must be logged in to connect GitHub.');
    }

    const origin = window.location.origin;
    const authHeaders = await getAuthHeaders();
    const connectRes = await fetch(
      `/api/github/connect?origin=${encodeURIComponent(origin)}`,
      { headers: authHeaders }
    );

    if (!connectRes.ok) {
      const errData = await connectRes.json().catch(() => ({ error: 'Failed to initiate GitHub OAuth' }));
      throw new Error(errData.error || 'Failed to start GitHub authorization');
    }

    const { url } = await connectRes.json();
    if (!url) {
      throw new Error('Server did not return a valid GitHub authorization URL.');
    }

    // Open popup to GitHub authorization
    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'github_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      throw new Error('Popup blocked by browser. Please allow popups for Vivexa DeployX to authorize GitHub.');
    }

    // Wait for postMessage from popup callback
    return new Promise((resolve, reject) => {
      let isSettled = false;

      const messageListener = async (event: MessageEvent) => {
        // Validate origin
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
          isSettled = true;
          window.removeEventListener('message', messageListener);
          clearInterval(popupPoll);

          const username = event.data.username || 'github-user';
          const avatarUrl = event.data.avatarUrl || '';
          const githubUserId = event.data.githubUserId || '';

          // Save public metadata in Firestore
          try {
            await setDoc(doc(db, 'githubConnections', userId), {
              id: userId,
              userId,
              githubUsername: username,
              githubAvatar: avatarUrl,
              githubUserId,
              provider: 'github',
              connectedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Could not save GitHub connection to Firestore:', e);
          }

          resolve({ success: true, username, avatarUrl });
        } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
          isSettled = true;
          window.removeEventListener('message', messageListener);
          clearInterval(popupPoll);
          reject(new Error(event.data.error || 'GitHub authorization was canceled or failed.'));
        }
      };

      window.addEventListener('message', messageListener);

      // Check if popup was closed by the user
      const popupPoll = setInterval(() => {
        if (popup.closed && !isSettled) {
          clearInterval(popupPoll);
          window.removeEventListener('message', messageListener);
          // Give 500ms grace period in case message just arrived
          setTimeout(async () => {
            if (!isSettled) {
              // Check if server recorded the connection
              const conn = await githubService.getGitHubConnection(userId);
              if (conn) {
                resolve({ success: true, username: conn.githubUsername, avatarUrl: conn.githubAvatar });
              } else {
                reject(new Error('GitHub authorization was closed without completing.'));
              }
            }
          }, 500);
        }
      }, 500);
    });
  },

  /**
   * Disconnect GitHub
   * Revokes server session and removes connection record
   */
  async disconnectGitHub(userId: string): Promise<void> {
    if (!userId) return;

    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/github/disconnect', {
      method: 'POST',
      headers: authHeaders,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to disconnect GitHub account.');
    }

    try {
      await deleteDoc(doc(db, 'githubConnections', userId));
    } catch (e) {
      console.warn('Firestore deleteDoc failed:', e);
    }
  },

  /**
   * List repositories accessible to the user via server proxy
   */
  async getRepositories(userId: string, search = ''): Promise<GitHubRepo[]> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(
      `/api/github/repos?userId=${encodeURIComponent(userId)}&search=${encodeURIComponent(search)}`,
      { headers: authHeaders }
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('GitHub account is not connected or authorization expired. Please connect GitHub.');
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to fetch repositories (HTTP ${res.status})`);
    }

    const data = await res.json();
    return asList(data, 'repos').map(toGitHubRepo);
  },

  /**
   * List branches for a repository
   */
  async getBranches(userId: string, owner: string, repo: string): Promise<GitHubBranch[]> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(
      `/api/github/branches?userId=${encodeURIComponent(userId)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      { headers: authHeaders }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to fetch branches for ${owner}/${repo}`);
    }

    const data = await res.json();
    return asList(data, 'branches').map(toGitHubBranch);
  },

  /**
   * Detect framework preset from repository contents
   */
  async detectFramework(userId: string, owner: string, repo: string): Promise<string> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `/api/github/detect-framework?userId=${encodeURIComponent(userId)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        { headers: authHeaders }
      );

      if (res.ok) {
        const data = await res.json();
        return data.framework || 'vite';
      }
    } catch {
      // Fallback
    }

    return 'vite';
  },

  /**
   * Deeply inspect repository source, framework, build settings, package managers, and root directory
   */
  async inspectRepository(
    userId: string,
    owner: string,
    repo: string,
    branch = 'main',
    rootDirectory = ''
  ): Promise<RepoInspectionResult> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/hosting/inspect-repo', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo, branch, rootDirectory, userId }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Repository inspection error:', e);
    }

    return {
      success: false,
      detectedFramework: 'vite',
      frameworkName: 'Vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
      packageManager: 'npm',
      hasPackageJson: true,
      isStatic: false,
      rootDirectory,
      rootDirectoryValid: true,
      candidateRootDirectories: [],
      availableScripts: [],
    };
  },

  /**
   * Helper to get framework preset defaults
   */
  getPresetDefaults(frameworkId: string) {
    return (
      FRAMEWORK_PRESETS.find((p) => p.id === frameworkId) ||
      FRAMEWORK_PRESETS.find((p) => p.id === 'vite')!
    );
  },
};
