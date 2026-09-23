/**
 * API Client Helper
 * Attaches Firebase authentication tokens and headers to backend API requests.
 */

import { auth } from '../config/firebase';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    headers['x-user-id'] = currentUser.uid;
    try {
      const token = await currentUser.getIdToken();
      // Ensure the token is a valid non-empty 3-part JWT
      if (token && typeof token === 'string' && token.split('.').length === 3) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // If token retrieval fails, x-user-id is retained as fallback
    }
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
