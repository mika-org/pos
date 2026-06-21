"use client";

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try Supabase auth first
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // FALLBACK: Local DB Check
        console.warn('Supabase Auth failed, checking local users...', error.message);
        
        // Auto-seed admin if no users exist
        const userCount = await db.users.count();
        if (userCount === 0 && (email === 'admin@store.com' || email === 'admin@admin.com') && password === 'admin123') {
          // Reverted: Default admin remains in-memory only and is not written to the local database
          login({ id: 'local-admin', email, role: 'admin', name: 'Admin Default' });
          return;
        }

        const localUser = await db.users.where('email').equals(email).first();
        
        if (localUser && localUser.password && bcrypt.compareSync(password, localUser.password) && !localUser.deleted) {
          login({ id: localUser.id!.toString(), email, role: localUser.role, name: localUser.name });
        } else {
          throw new Error('Invalid credentials');
        }
      } else if (data.user) {
        // Assume successful supabase login (we might fetch role from a profile table later)
        login({ 
          id: data.user.id, 
          email: data.user.email || email, 
          role: 'admin', // Placeholder role for supabase user
          name: data.user.email?.split('@')[0] || 'User'
        });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center bg-slate-900">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            POS System
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Masuk ke akun Anda</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl flex items-start space-x-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@store.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
