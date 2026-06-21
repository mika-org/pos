"use client";

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Save, Store, Calculator, Database, Download, Cloud, QrCode, UploadCloud, X } from 'lucide-react';
import { exportLocalDb, exportSupabaseDb } from '@/lib/backupUtils';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if store updates from elsewhere
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate network delay
    setTimeout(() => {
      updateSettings(formData);
      setIsSaving(false);
      alert('Pengaturan berhasil disimpan!');
    }, 500);
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

        {/* Tax Rules Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Calculator className="text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-800">Pengaturan Pajak</h2>
          </div>
          
          <div className="p-6">
            <div className="max-w-md space-y-2">
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

        {/* Backup Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center space-x-3">
            <Database className="text-purple-500" />
            <h2 className="text-lg font-bold text-slate-800">Database & Backup</h2>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-6">Unduh cadangan (backup) data sistem dalam format JSON. Anda dapat membackup data yang tersimpan di perangkat lokal maupun data yang ada di server cloud (Supabase).</p>
            
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
              <button
                type="button"
                onClick={async () => {
                  const tid = toast.loading('Memproses backup lokal...');
                  const res = await exportLocalDb();
                  if (res.success) {
                    toast.success('Backup lokal berhasil diunduh!', { id: tid });
                  } else {
                    toast.error(`Gagal: ${res.error}`, { id: tid });
                  }
                }}
                className="flex flex-1 items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-3 rounded-xl font-medium transition-colors"
              >
                <Download size={18} />
                <span>Backup Local DB (JSON)</span>
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  const tid = toast.loading('Memproses backup server...');
                  const res = await exportSupabaseDb();
                  if (res.success) {
                    toast.success('Backup server berhasil diunduh!', { id: tid });
                  } else {
                    toast.error(`Gagal: ${res.error}`, { id: tid });
                  }
                }}
                className="flex flex-1 items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-medium transition-colors"
              >
                <Cloud size={18} />
                <span>Backup Supabase DB (JSON)</span>
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
