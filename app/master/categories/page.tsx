"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db';
import { syncData } from '@/lib/sync';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories from IndexedDB reactively
  const categories = useLiveQuery(
    () => db.categories
      .filter(cat => !cat.deleted && cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .reverse()
      .sortBy('createdAt'),
    [searchQuery]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingId) {
        await db.categories.update(editingId, {
          name: formData.name,
          updatedAt: Date.now(),
          synced: false,
        });
      } else {
        // Generate a secure UUID locally to avoid conflicts during synchronization
        await db.categories.add({
          id: crypto.randomUUID(),
          name: formData.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: false,
          deleted: false,
        });
      }
      closeModal();
      syncData(true);
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Gagal menyimpan kategori');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus kategori ini?')) {
      try {
        // Soft delete for offline sync support
        await db.categories.update(id, {
          deleted: true,
          updatedAt: Date.now(),
          synced: false
        });
        syncData(true);
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingId(category.id!);
      setFormData({ name: category.name });
    } else {
      setEditingId(null);
      setFormData({ name: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kategori Produk</h1>
          <p className="text-sm text-slate-500">Kelola kategori produk untuk memudahkan pencarian di Kasir</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus size={18} className="mr-2" />
          Tambah Kategori
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center">
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari kategori..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Nama Kategori</th>
                <th className="p-4 font-medium w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories === undefined ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">Memuat data...</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">Belum ada kategori ditemukan</td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-800 font-medium">{category.name}</td>
                    <td className="p-4 flex justify-center space-x-2">
                      <button 
                        onClick={() => openModal(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(category.id!)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Contoh: Minuman, Makanan Ringan"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
