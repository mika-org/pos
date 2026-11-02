"use client";

import { LoginView } from '@/components/auth/LoginView';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, logout } = useAuthStore();
  const router = useRouter();

  // Verify server session on mount
  useEffect(() => {
    let cancelled = false;

    const verifyServerSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            login(data.user);
            if (data.user.tenantSlug) localStorage.setItem('pos_tenant_slug', data.user.tenantSlug);
            const target = data.user.role === 'super_admin' ? '/super-admin/tenants' : '/dashboard';
            router.replace(target);
            return;
          }
        }

        // If server session is absent or expired, purge any stale client-side persist state
        await logout();
      } catch {
        if (!cancelled) {
          await logout();
        }
      }
    };

    void verifyServerSession();

    return () => {
      cancelled = true;
    };
  }, [router, login, logout]);

  return <LoginView />;
}
