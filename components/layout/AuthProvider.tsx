"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRouter, usePathname } from 'next/navigation';
import { decodeJWT, isJWTExpired } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First tone (C5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.frequency.value = 523.25;
    osc1.type = 'sine';

    // Second tone (E5)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.frequency.value = 659.25;
    osc2.type = 'sine';

    const now = audioCtx.currentTime;
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.start(now);
    osc1.stop(now + 0.5);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.error('Audio chime error:', err);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, login, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const { fetchSettings } = useSettingsStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);

    const checkAuth = () => {
      if (typeof window === 'undefined') return;

      const token = localStorage.getItem('pos_jwt_token');
      if (token) {
        const payload = decodeJWT(token);
        if (payload && !isJWTExpired(payload)) {
          // Sync payload back to store if we just reloaded the page
          if (!isAuthenticated) {
            login({
              id: payload.id,
              email: payload.email,
              role: payload.role,
              name: payload.name
            });
          }
          fetchSettings();
        } else {
          // Expired or invalid token, clear session
          localStorage.removeItem('pos_jwt_token');
          logout();
          router.push('/login');
        }
      } else {
        if (!isAuthenticated) {
          router.push('/login');
        }
      }
    };

    checkAuth();
  }, [isAuthenticated, pathname, router, login, logout, fetchSettings]);

  // Real-time listener for incoming customer orders
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('incoming-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_orders' },
        (payload) => {
          const order = payload.new;
          
          // Sound effect chime
          playChime();

          // Display visual notification toast
          const tableLabel = order.table_id ? `Meja ${order.table_id.replace('meja_', '')}` : 'Takeaway';
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 border border-slate-800 text-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}>
              <div className="flex-1 w-0">
                <div className="flex items-start">
                  <div className="shrink-0 pt-0.5">
                    <span className="text-xl">🔔</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-black text-white">Pesanan Baru Masuk!</p>
                    <p className="mt-1 text-xs text-slate-400 font-semibold leading-relaxed">
                      ID: <span className="text-blue-400 underline font-black">{order.id}</span> dari <span className="font-extrabold text-slate-200">{order.customer_name}</span> ({tableLabel})
                    </p>
                    <p className="mt-1.5 text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                      Total: Rp {order.total_amount.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="ml-4 shrink-0 flex">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="bg-transparent hover:bg-slate-800 rounded-xl p-2 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold uppercase shrink-0"
                >
                  Tutup
                </button>
              </div>
            </div>
          ), { duration: 8000 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Avoid hydration mismatch by waiting for client-side render
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-semibold text-sm">Mengalihkan ke halaman login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
