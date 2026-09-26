/**
 * API Client Helper
 * Attaches Firebase authentication tokens and headers to backend API requests.
 */

import { auth } from '../config/firebase';

export async function getAuthHeaders(options?: { forceRefresh?: boolean }): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return headers;
  }

  headers['x-user-id'] = currentUser.uid;

  try {
    const token = await currentUser.getIdToken(Boolean(options?.forceRefresh));
    if (token && typeof token === 'string' && token.split('.').length === 3) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err: any) {
    throw new Error(err?.message || 'Could not refresh your session. Please sign in again.');
  }

  if (!headers['Authorization']) {
    throw new Error('Could not create an authentication token. Please sign in again.');
  }

  return headers;
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  };

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}
