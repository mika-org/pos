"use client";

import { LoginView } from '@/components/auth/LoginView';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { isAuthenticated, user, login } = useAuthStore();
  const router = useRouter();

  // If user is already logged in, redirect them back to dashboard / super-admin
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(user.role === 'super_admin' ? '/super-admin/tenants' : '/dashboard');
      return;
    }

    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          login(data.user);
          if (data.user.tenantSlug) localStorage.setItem('pos_tenant_slug', data.user.tenantSlug);
          router.replace(data.user.role === 'super_admin' ? '/super-admin/tenants' : '/dashboard');
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, router, login]);

  return <LoginView />;
}
