import fs from 'fs';
import path from 'path';

const TOKEN_STORE_PATH = path.join('/tmp', 'vivexa_gh_tokens.json');

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
      fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(this.memoryStore), 'utf-8');
    } catch (e) {
      console.error('Failed to persist token store to disk:', e);
    }
  }

  public saveToken(userId: string, data: StoredToken) {
    this.memoryStore[userId] = data;
    this.persistToDisk();
  }

  public getToken(userId: string): StoredToken | null {
    // Re-check disk in case another process/thread updated it
    this.loadFromDisk();
    return this.memoryStore[userId] || null;
  }

  public deleteToken(userId: string) {
    delete this.memoryStore[userId];
    this.persistToDisk();
  }

  public getAll(): Record<string, StoredToken> {
    this.loadFromDisk();
    return { ...this.memoryStore };
  }
}

export const tokenStore = new TokenStore();
