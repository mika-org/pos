import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'super_admin' | 'admin' | 'kasir';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  tenantId?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pos_tenant_slug');
          void fetch('/api/auth/logout', { method: 'POST' });
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'pos-auth-storage',
    }
  )
);
