"use client";

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Save, Store, Calculator, Database, Cloud, QrCode, UploadCloud, X, Landmark, Plus, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { exportPostgresDb } from '@/lib/backupUtils';
import toast from 'react-hot-toast';
import { useTranslation } from '@/stores/languageStore';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [xenditForm, setXenditForm] = useState({ enabled: false, environment: 'development' as 'development' | 'production', secretKey: '', callbackToken: '' });
  const [xenditConfigured, setXenditConfigured] = useState(false);
  const [callbackConfigured, setCallbackConfigured] = useState(false);
  const { t } = useTranslation();

  const addBankAccount = () => {
    if (!newBank.bankName.trim() || !newBank.accountNumber.trim() || !newBank.accountHolder.trim()) {
      toast.error("Semua kolom bank wajib diisi!");
      return;
    }
    setFormData(prev => ({
      ...prev,
      bankAccounts: [
        ...(prev.bankAccounts || []),
        {
          id: `bank_${Date.now()}`,
          bankName: newBank.bankName.trim(),
          accountNumber: newBank.accountNumber.trim(),
          accountHolder: newBank.accountHolder.trim()
        }
      ]
    }));
    setNewBank({ bankName: '', accountNumber: '', accountHolder: '' });
    toast.success("Rekening berhasil ditambahkan ke daftar!");
  };

  const removeBankAccount = (id: string) => {
    setFormData(prev => ({
      ...prev,
      bankAccounts: (prev.bankAccounts || []).filter(b => b.id !== id)
    }));
    toast.success("Rekening dihapus dari daftar.");
  };

  // Sync state if store updates from elsewhere
  useEffect(() => {
    const timer = window.setTimeout(() => setFormData(settings), 0);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    const loadPaymentSettings = async () => {
      const response = await fetch('/api/payment-settings', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setXenditForm((current) => ({ ...current, enabled: data.enabled, environment: data.environment }));
      setXenditConfigured(Boolean(data.configured));
      setCallbackConfigured(Boolean(data.callbackConfigured));
    };
    void loadPaymentSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar! Maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormData(prev => ({
          ...prev,
          qrisImage: event.target!.result as string
        }));
        toast.success('QRIS berhasil diunggah!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await updateSettings(formData);
      const paymentResponse = await fetch('/api/payment-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(xenditForm),
      });
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) throw new Error(paymentData.error || 'Gagal menyimpan Xendit');
      setXenditConfigured(Boolean(paymentData.configured));
      setCallbackConfigured(Boolean(paymentData.callbackConfigured));
      setXenditForm((current) => ({ ...current, secretKey: '', callbackToken: '' }));
      toast.success('Pengaturan berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-slate-500 text-sm">Kelola profil toko dan aturan pajak Anda di sini.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Profile Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Store className="text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800">Profil Toko</h2>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nama Toko</label>
                <input 
                  type="text" 
                  name="storeName"
                  value={formData.storeName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nomor Telepon</label>
                <input 
                  type="text" 
                  name="storePhone"
                  value={formData.storePhone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Alamat Toko</label>
              <input 
                type="text" 
                name="storeAddress"
                value={formData.storeAddress}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Tax & Order Rules Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Calculator className="text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-800">Aturan Penjualan & Pajak</h2>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Pajak Penjualan (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  name="taxPercentage"
                  min="0"
                  max="100"
                  value={formData.taxPercentage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-8"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-medium">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Pajak ini akan otomatis ditambahkan ke total belanja pelanggan saat checkout.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Maks. Ukuran Bukti Bayar (MB)</label>
              <div className="relative">
                <input 
                  type="number" 
                  name="maxFileSize"
                  min="1"
                  max="50"
                  value={formData.maxFileSize || 5}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-medium">MB</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ukuran maksimum berkas unggahan bukti pembayaran yang diizinkan untuk customer (1-50 MB).
              </p>
            </div>
          </div>
        </div>

        {/* QRIS Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <QrCode className="text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-800">QRIS Pembayaran</h2>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500">Unggah gambar QR code QRIS toko Anda agar pelanggan dapat melakukan pembayaran secara non-tunai saat checkout di POS.</p>
            
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100/50 transition-colors relative">
              {formData.qrisImage ? (
                <div className="relative flex flex-col items-center">
                  <div className="relative group bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <img 
                      src={formData.qrisImage} 
                      alt="QRIS QR Code" 
                      className="w-48 h-48 object-contain" 
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, qrisImage: '' }))}
                      className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-md transition-colors animate-in fade-in duration-200"
                      title="Hapus QRIS"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-medium">Klik tombol silang di atas untuk mengganti gambar.</p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full py-6 cursor-pointer select-none">
                  <UploadCloud size={48} className="text-slate-400 mb-3" />
                  <span className="text-sm font-semibold text-slate-600">Pilih berkas gambar QRIS</span>
                  <span className="text-xs text-slate-400 mt-1">Format PNG, JPG, atau JPEG (Maks. 2MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrisUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Xendit Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <ShieldCheck className="text-indigo-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Xendit QRIS Dinamis</h2>
              <p className="text-xs text-slate-500">Secret key terenkripsi dan hanya dipakai oleh server tenant ini.</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span>
                <span className="block text-sm font-bold text-slate-800">Aktifkan Xendit</span>
                <span className="block text-xs text-slate-500">Jika tidak aktif/tidak tersedia, sistem memakai gambar QRIS statis di atas.</span>
              </span>
              <input type="checkbox" checked={xenditForm.enabled} onChange={(event) => setXenditForm({ ...xenditForm, enabled: event.target.checked })} className="w-5 h-5" />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Environment</label>
                <select value={xenditForm.environment} onChange={(event) => setXenditForm({ ...xenditForm, environment: event.target.value as 'development' | 'production' })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white">
                  <option value="development">Development / Test</option>
                  <option value="production">Production / Live</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Secret API Key {xenditConfigured && <span className="text-emerald-600">(sudah tersimpan)</span>}</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="password" value={xenditForm.secretKey} onChange={(event) => setXenditForm({ ...xenditForm, secretKey: event.target.value })} placeholder={xenditConfigured ? 'Kosongkan untuk mempertahankan key' : 'xnd_development_...'} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Webhook Callback Token {callbackConfigured && <span className="text-emerald-600">(sudah tersimpan)</span>}</label>
                <input type="password" value={xenditForm.callbackToken} onChange={(event) => setXenditForm({ ...xenditForm, callbackToken: event.target.value })} placeholder={callbackConfigured ? 'Kosongkan untuk mempertahankan token' : 'Token dari pengaturan webhook Xendit'} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" />
                <p className="text-xs text-slate-500">Webhook URL: <code>/api/payments/xendit/webhook</code></p>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Accounts Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Landmark className="text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800">{t('bankAccountsSettings')}</h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* List of existing bank accounts */}
            <div className="space-y-3">
              {(!formData.bankAccounts || formData.bankAccounts.length === 0) ? (
                <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">
                  Belum ada rekening bank yang terdaftar.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.bankAccounts.map((bank) => (
                    <div 
                      key={bank.id} 
                      className="p-4 bg-slate-50 border border-slate-250 rounded-2xl flex justify-between items-center shadow-sm"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                          {bank.bankName}
                        </span>
                        <p className="text-base font-black text-slate-800 tracking-wider mt-1">{bank.accountNumber}</p>
                        <p className="text-xs text-slate-550 font-semibold">a.n. {bank.accountHolder}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBankAccount(bank.id)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Hapus Rekening"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to add new bank account */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
              <h3 className="text-xs text-slate-400 font-extrabold uppercase tracking-widest flex items-center">
                <Plus size={14} className="mr-1.5" />
                <span>{t('addBankAccount')}</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('bankNameLabel')}</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Bank BCA"
                    value={newBank.bankName}
                    onChange={(e) => setNewBank(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('accountNumberLabel')}</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 8015-xxxx-xx"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank(prev => ({ ...prev, accountNumber: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-255 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('accountHolderLabel')}</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: PT POS Sukses"
                    value={newBank.accountHolder}
                    onChange={(e) => setNewBank(prev => ({ ...prev, accountHolder: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={addBankAccount}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center"
                >
                  <Plus size={14} className="mr-1.5" />
                  <span>Tambahkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Database className="text-purple-500" />
            <h2 className="text-lg font-bold text-slate-800">Database & Backup</h2>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-6">Unduh cadangan data tenant aktif dalam format JSON langsung dari PostgreSQL.</p>
            
            <div className="flex">
              <button
                type="button"
                onClick={async () => {
                  const tid = toast.loading('Memproses backup server...');
                  const res = await exportPostgresDb();
                  if (res.success) {
                    toast.success('Backup server berhasil diunduh!', { id: tid });
                  } else {
                    toast.error(`Gagal: ${res.error}`, { id: tid });
                  }
                }}
                className="flex flex-1 items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-medium transition-colors"
              >
                <Cloud size={18} />
                <span>Backup PostgreSQL Tenant (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            <Save size={20} />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
