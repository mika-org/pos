"use client";

import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, History, Tag, Truck, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col transition-all duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          POS System
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <Link href="/dashboard" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        
        <div className="pt-4 pb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">Transaksi</p>
        </div>
        <Link href="/pos" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-emerald-400">
          <ShoppingCart size={20} />
          <span className="font-medium">Kasir (POS)</span>
        </Link>
        <Link href="/history" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
          <History size={20} />
          <span>Riwayat Transaksi</span>
        </Link>

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">Master Data</p>
            </div>
            <Link href="/master/products" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Package size={20} />
              <span>Produk</span>
            </Link>
            <Link href="/master/users" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-blue-400">
              <Users size={20} />
              <span className="font-medium">Pengguna</span>
            </Link>
            <Link href="/master/categories" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Tag size={20} />
              <span>Kategori</span>
            </Link>
            <Link href="/master/customers" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Users size={20} />
              <span>Customer</span>
            </Link>
            <Link href="/master/suppliers" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Truck size={20} />
              <span>Supplier</span>
            </Link>

            <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">Lainnya</p>
            </div>
            <Link href="/reports" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <FileText size={20} />
              <span>Laporan</span>
            </Link>
            <Link href="/settings" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Settings size={20} />
              <span>Pengaturan</span>
            </Link>
          </>
        )}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-emerald-400 capitalize">{user?.role || 'kasir'}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
