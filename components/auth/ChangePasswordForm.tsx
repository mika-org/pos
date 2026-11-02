"use client";

import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

const initialForm = { currentPassword: '', newPassword: '', confirmation: '' };

export function ChangePasswordForm() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  if (!user || !['super_admin', 'admin'].includes(user.role)) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmation) {
      toast.error('Konfirmasi password baru tidak cocok');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Gagal mengubah password');

      setForm(initialForm);
      toast.success('Password berhasil diubah. Silakan masuk kembali.');
      await logout();
      router.replace('/login');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <KeyRound className="text-indigo-600" />
        <div>
          <h2 className="font-black text-slate-800">Keamanan Akun</h2>
          <p className="text-xs text-slate-500">Ubah password {user.role === 'super_admin' ? 'Super Admin' : 'admin tenant'} dengan BCrypt cost 12.</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PasswordInput
            label="Password saat ini"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(value) => setForm((current) => ({ ...current, currentPassword: value }))}
          />
          <PasswordInput
            label="Password baru"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(value) => setForm((current) => ({ ...current, newPassword: value }))}
          />
          <PasswordInput
            label="Ulangi password baru"
            autoComplete="new-password"
            value={form.confirmation}
            onChange={(value) => setForm((current) => ({ ...current, confirmation: value }))}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-500">Minimal 10 karakter dan maksimal 72 byte. Setelah disimpan Anda harus login kembali.</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Ubah Password'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordInput({
  label,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        required
        minLength={label === 'Password saat ini' ? 1 : 10}
        maxLength={72}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}
