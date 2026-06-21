"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AppUser } from '@/lib/db';
import { syncData } from '@/lib/sync';
import bcrypt from 'bcryptjs';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, Edit2, Trash2, Users, Shield, Key } from 'lucide-react';

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'kasir' as 'admin' | 'kasir'
  });

  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const users = useLiveQuery(
    () => db.users.filter(u => !u.deleted).toArray()
  ) || [];

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'kasir' });
    setEditingId(null);
  };

  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: user.password || '',
        role: user.role
      });
      setEditingId(user.id!.toString());
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const hashPasswordIfNeeded = (pass: string) => {
        if (pass.startsWith('$2a$') || pass.startsWith('$2b$') || pass.startsWith('$2y$')) {
          return pass;
        }
        const salt = bcrypt.genSaltSync(10);
        return bcrypt.hashSync(pass, salt);
      };

      const hashedPassword = hashPasswordIfNeeded(formData.password);

      if (editingId) {
        await db.users.update(editingId, {
          name: formData.name,
          email: formData.email,
          password: hashedPassword,
          role: formData.role,
          updatedAt: Date.now(),
          synced: false
        });
      } else {
        await db.users.add({
          id: crypto.randomUUID(),
          name: formData.name,
          email: formData.email,
          password: hashedPassword,
          role: formData.role,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: false,
          deleted: false
        });
      }
      setIsModalOpen(false);
      resetForm();
      syncData(true);
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('Gagal menyimpan pengguna');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        await db.users.update(id, {
          deleted: true,
          updatedAt: Date.now(),
          synced: false
        });
        syncData(true);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  if (!isAdmin) {
    return <div className="p-6 text-rose-500 font-medium">Akses ditolak. Halaman ini khusus Admin.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h1>
          <p className="text-slate-500 text-sm">Kelola akun Admin dan Kasir</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative w-64">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari pengguna..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Nama</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Belum ada pengguna yang ditambahkan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        user.role === 'admin' 
                          ? 'bg-purple-50 text-purple-600 border-purple-200' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Kasir'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.id!.toString())}
                          disabled={user.email === currentUser?.email}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                <div className="relative">
                  <Users size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email / Username</label>
                <div className="relative">
                  <Shield size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password Lokal</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  />
                </div>
                <p className="text-xs text-slate-400">Gunakan password yang mudah diingat untuk login mesin kasir.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as 'admin'|'kasir'})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
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
