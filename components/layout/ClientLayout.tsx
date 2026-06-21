"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AuthProvider } from "@/components/layout/AuthProvider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Public customer order routes (no login required, no sidebar/header)
  const isPublicRoute = pathname === '/order' || pathname?.startsWith('/order/') || pathname === '/login';

  if (isPublicRoute) {
    return <div className="min-h-screen bg-slate-50 overflow-y-auto">{children}</div>;
  }

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
