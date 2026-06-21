import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'kasir';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
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
          localStorage.removeItem('pos_jwt_token');
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'pos-auth-storage',
    }
  )
);
