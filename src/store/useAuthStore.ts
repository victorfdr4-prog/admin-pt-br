import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccessScope, FunctionalProfile, SystemRole } from '@/domain/accessControl';

interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: SystemRole;
  access_scope: AccessScope;
  functional_profile: FunctionalProfile;
  role_label?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => void;
  setInitialized: (value: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: true,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true, isInitialized: true }),
      setInitialized: (value) => set({ isInitialized: value }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      logout: () => set({ user: null, token: null, isAuthenticated: false, isInitialized: true }),
    }),
    { name: 'cromia-auth' }
  )
);
