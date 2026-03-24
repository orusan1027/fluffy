import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { AuthUser } from '@scarney/shared';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.auth.login({ email, password });
      set({ accessToken: res.accessToken, user: res.user, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  signup: async (username, email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.auth.signup({ username, email, password });
      set({ accessToken: res.accessToken, user: res.user, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  refreshSession: async () => {
    try {
      const res = await api.auth.refresh();
      set({ accessToken: res.accessToken, user: res.user });
    } catch {
      set({ accessToken: null, user: null });
      throw new Error('Session expired');
    }
  },

  logout: async () => {
    const token = get().accessToken;
    set({ accessToken: null, user: null });
    if (token) {
      await api.auth.logout(token).catch(() => {});
    }
  },

  clearError: () => set({ error: null }),
}));
