"use client";

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateJWT } from '@/lib/jwt';

export function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Query user's actual profile (including role and name) from public.users table in Supabase
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        throw new Error('Email atau password salah');
      }

      if (profile.deleted) {
        throw new Error('Akun Anda telah dinonaktifkan');
      }

      // Verify bcrypt password hash
      const isPasswordCorrect = bcrypt.compareSync(password, profile.password || '');
      if (!isPasswordCorrect) {
        throw new Error('Email atau password salah');
      }

      // Generate JWT Token
      const userPayload = { 
        id: profile.id, 
        email: profile.email, 
        role: (profile.role as 'admin' | 'kasir') || 'kasir', 
        name: profile.name || 'User'
      };
      const token = generateJWT(userPayload);
      localStorage.setItem('pos_jwt_token', token);

      // Successful login
      login(userPayload);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans antialiased text-slate-200">
      
      {/* Glow Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Login Card */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 w-full max-w-md rounded-[32px] shadow-2xl p-8 relative z-10 space-y-6">
        
        {/* Header Rebranding & Logo */}
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-linear-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-blue-500/20 transition-transform duration-300 hover:rotate-3 select-none">
            R
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">RestoFlow</h1>
            <p className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest">Smart POS & Resto Platform</p>
          </div>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            Masuk untuk mengakses kasir, pesanan pelanggan, manajemen meja, dan laporan keuangan.
          </p>
        </div>

        {/* Reusable Error Banner */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed animate-in zoom-in duration-200">
            <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@store.com"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950/40 border border-slate-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-semibold text-slate-200 placeholder:text-slate-650"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3.5 bg-slate-950/40 border border-slate-800 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-semibold text-slate-200 placeholder:text-slate-650"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 mt-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <span>Masuk Ke Sistem</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info decoration */}
        <p className="text-[9px] text-slate-500 font-bold text-center uppercase tracking-widest select-none">
          RestoFlow © 2026
        </p>

      </div>
    </div>
  );
}

