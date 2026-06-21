"use client";

import { useState, useEffect } from 'react';
import { Category } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false, id: null, name: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('deleted', false)
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('Error fetching categories:', error);
      } else {
        setCategories(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name,
            updatedAt: Date.now(),
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            id: crypto.randomUUID(),
            name: formData.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            deleted: false,
          });
        if (error) throw error;
      }
      closeModal();
      await fetchCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error('Gagal menyimpan kategori');
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDelete({ open: true, id, name });
  };

  const executeDelete = async () => {
    if (!confirmDelete.id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          deleted: true,
          updatedAt: Date.now()
        })
        .eq('id', confirmDelete.id);
      if (error) throw error;
      toast.success(`Kategori "${confirmDelete.name}" berhasil dihapus`);
      setConfirmDelete({ open: false, id: null, name: '' });
      await fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Gagal menghapus kategori');
    } finally {
      setIsDeleting(false);
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
              {isLoading ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">Memuat data...</td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">Belum ada kategori ditemukan</td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
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
                        onClick={() => handleDelete(category.id!, category.name)}
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

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={executeDelete}
        title={`Hapus Kategori "${confirmDelete.name}"?`}
        message="Kategori yang dihapus tidak akan muncul di sistem lagi. Produk yang terhubung ke kategori ini akan tetap ada."
        detail="Tindakan ini bersifat permanen dan tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus Kategori"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
