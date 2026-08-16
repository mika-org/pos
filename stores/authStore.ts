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
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: async () => {
        try {
          if (typeof window !== 'undefined') {
            await fetch('/api/auth/logout', { method: 'POST' });
          }
        } catch {
          // State lokal tetap harus dibersihkan bila jaringan terputus.
        } finally {
          if (typeof window !== 'undefined') localStorage.removeItem('pos_tenant_slug');
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'pos-auth-storage',
    }
  )
);
