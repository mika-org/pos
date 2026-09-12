"use client";

import { LoginView } from '@/components/auth/LoginView';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  // If user is already logged in, redirect them back to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(user.role === 'super_admin' ? '/super-admin/tenants' : '/dashboard');
    }
  }, [isAuthenticated, user, router]);

  return <LoginView />;
}
