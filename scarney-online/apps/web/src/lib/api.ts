import type { AuthResponse, LoginRequest, SignupRequest } from '@scarney/shared';

const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  auth: {
    signup: (payload: SignupRequest) =>
      request<AuthResponse>('POST', '/api/auth/signup', payload),

    login: (payload: LoginRequest) =>
      request<AuthResponse>('POST', '/api/auth/login', payload),

    refresh: () =>
      request<AuthResponse>('POST', '/api/auth/refresh'),

    logout: (token: string) =>
      request<void>('POST', '/api/auth/logout', undefined, token),
  },

  ranking: {
    list: (token: string) =>
      request<{ entries: Array<{ rank: number; userId: string; username: string; avatarEmoji: string; totalWinnings: number; handsPlayed: number }> }>(
        'GET', '/api/ranking', undefined, token,
      ),
  },
};
