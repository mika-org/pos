"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LoginView } from '@/components/auth/LoginView';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const { fetchSettings } = useSettingsStore();

  useEffect(() => {
    setMounted(true);

    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  // Avoid hydration mismatch by waiting for client-side render
  if (!mounted) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <>{children}</>;
}
