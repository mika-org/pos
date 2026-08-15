"use client";

import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, ShieldCheck, Store, Users, Package, ReceiptText, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended';
  storeName: string;
  xenditEnabled: boolean;
  xenditConfigured: boolean;
  counts: { users: number; products: number; transactions: number; customerOrders: number };
}

const initialForm = { name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' };

export default function TenantsPage() {
  const user = useAuthStore((state) => state.user);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTenants = useCallback(async () => {
    const response = await fetch('/api/super-admin/tenants', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) toast.error(payload.error || 'Gagal memuat tenant');
    else setTenants(payload.tenants || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTenants(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadTenants]);

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/super-admin/tenants', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) toast.error(payload.error || 'Gagal membuat tenant');
    else {
      toast.success('Tenant dan akun admin berhasil dibuat');
      setForm(initialForm);
      await loadTenants();
    }
    setSaving(false);
  };

  const toggleStatus = async (tenant: TenantRow) => {
    const status = tenant.status === 'active' ? 'suspended' : 'active';
    const response = await fetch('/api/super-admin/tenants', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: tenant.id, status }),
    });
    const payload = await response.json();
    if (!response.ok) toast.error(payload.error || 'Gagal mengubah status tenant');
    else {
      toast.success(status === 'active' ? 'Tenant diaktifkan' : 'Tenant ditangguhkan');
      await loadTenants();
    }
  };

  if (user?.role !== 'super_admin') return <div className="p-6 text-rose-600">Akses khusus Super Admin.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-700"><ShieldCheck /></div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Kontrol Multi-Tenant</h1>
          <p className="text-sm text-slate-500">Buat tenant, admin awal, dan atur status operasional dari satu tempat.</p>
        </div>
      </div>

      <form onSubmit={createTenant} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800"><Plus size={18} /> Tenant Baru</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input required placeholder="Nama tenant" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2.5 border rounded-xl" />
          <input required placeholder="kode-tenant" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="px-3 py-2.5 border rounded-xl" />
          <input required placeholder="Nama admin" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} className="px-3 py-2.5 border rounded-xl" />
          <input required type="email" placeholder="Email admin" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="px-3 py-2.5 border rounded-xl" />
          <input required minLength={10} type="password" placeholder="Password admin" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className="px-3 py-2.5 border rounded-xl" />
        </div>
        <button disabled={saving} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">
          {saving ? 'Membuat...' : 'Buat Tenant + Admin'}
        </button>
      </form>

      {loading ? <div className="text-sm text-slate-500">Memuat tenant...</div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {tenants.map((tenant) => (
            <article key={tenant.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-slate-100 rounded-xl"><Building2 size={20} /></div>
                  <div className="min-w-0">
                    <h2 className="font-black text-slate-900 truncate">{tenant.name}</h2>
                    <p className="text-xs font-mono text-slate-500">{tenant.slug}</p>
                  </div>
                </div>
                <button onClick={() => void toggleStatus(tenant)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${tenant.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <Power size={13} /> {tenant.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Metric icon={<Users size={15} />} value={tenant.counts.users} label="User" />
                <Metric icon={<Package size={15} />} value={tenant.counts.products} label="Produk" />
                <Metric icon={<ReceiptText size={15} />} value={tenant.counts.transactions} label="Transaksi" />
                <Metric icon={<Store size={15} />} value={tenant.counts.customerOrders} label="Pesanan" />
              </div>
              <div className="text-xs text-slate-500 flex justify-between border-t pt-3">
                <span>{tenant.storeName}</span>
                <span className={tenant.xenditEnabled && tenant.xenditConfigured ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {tenant.xenditEnabled && tenant.xenditConfigured ? 'Xendit aktif' : 'QRIS statis/fallback'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-xl bg-slate-50 p-2"><div className="flex justify-center text-slate-400">{icon}</div><p className="font-black text-slate-800">{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>;
}
