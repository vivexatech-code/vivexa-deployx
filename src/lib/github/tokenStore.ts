import fs from 'fs';
import path from 'path';
import { getAdminServices, isAdminConfigured } from '../firebase/admin';

const TOKEN_STORE_PATH = path.join(process.cwd(), '.data', 'github-tokens.json');

export interface StoredToken {
  token: string;
  username: string;
  avatarUrl?: string;
  connectedAt: string;
}

class TokenStore {
  private memoryStore: Record<string, StoredToken> = {};

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(TOKEN_STORE_PATH)) {
        const data = fs.readFileSync(TOKEN_STORE_PATH, 'utf-8');
        this.memoryStore = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not load token store from disk, starting empty:', e);
      this.memoryStore = {};
    }
  }

  private persistToDisk() {
    try {
      fs.mkdirSync(path.dirname(TOKEN_STORE_PATH), { recursive: true });
      fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(this.memoryStore), 'utf-8');
    } catch (e) {
      console.error('Failed to persist token store to disk:', e);
    }
  }

  private async writeFirestore(userId: string, data: StoredToken | null) {
    if (!isAdminConfigured()) return;
    const { adminDb } = getAdminServices();
    const ref = adminDb.collection('githubTokens').doc(userId);
    if (!data) {
      await ref.delete().catch(() => undefined);
      return;
    }
    await ref.set(data);
  }

  private async readFirestore(userId: string): Promise<StoredToken | null> {
    if (!isAdminConfigured()) return null;
    const { adminDb } = getAdminServices();
    const snap = await adminDb.collection('githubTokens').doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (!data.token || !data.username) return null;
    return {
      token: data.token,
      username: data.username,
      avatarUrl: data.avatarUrl || '',
      connectedAt: data.connectedAt || new Date().toISOString(),
    };
  }

  public async saveToken(userId: string, data: StoredToken): Promise<void> {
    this.memoryStore[userId] = data;
    this.persistToDisk();
    try {
      await this.writeFirestore(userId, data);
    } catch (e) {
      console.warn('Could not persist GitHub token to Firestore:', e);
    }
  }

  public async getToken(userId: string): Promise<StoredToken | null> {
    this.loadFromDisk();
    if (this.memoryStore[userId]) {
      return this.memoryStore[userId];
    }

    try {
      const remote = await this.readFirestore(userId);
      if (remote) {
        this.memoryStore[userId] = remote;
        this.persistToDisk();
        return remote;
      }
    } catch (e) {
      console.warn('Could not read GitHub token from Firestore:', e);
    }

    return null;
  }

  public async deleteToken(userId: string): Promise<void> {
    delete this.memoryStore[userId];
    this.persistToDisk();
    try {
      await this.writeFirestore(userId, null);
    } catch (e) {
      console.warn('Could not delete GitHub token from Firestore:', e);
    }
  }
}

export const tokenStore = new TokenStore();
