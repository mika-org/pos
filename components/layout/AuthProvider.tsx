"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { LoginView } from '@/components/auth/LoginView';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Periodic Background Sync (every 5 minutes)
    const syncInterval = setInterval(() => {
      if (isAuthenticated && navigator.onLine) {
        import('@/lib/sync').then(({ syncData }) => {
          syncData(true);
        });
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [isAuthenticated]);

  // Avoid hydration mismatch by waiting for client-side render
  if (!mounted) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <>{children}</>;
}
