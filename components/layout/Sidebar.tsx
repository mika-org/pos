"use client";

import Link from 'next/link';
import { 
  LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, 
  History, Tag, Truck, LogOut, ClipboardList, QrCode, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { useEffect, useState } from 'react';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useUiStore();
  const isAdmin = user?.role === 'admin';
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const collapsed = mounted ? sidebarCollapsed : false;
  const mobileOpen = mounted ? sidebarMobileOpen : false;

  const handleLinkClick = () => {
    if (mobileOpen) {
      setSidebarMobileOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200" 
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}
      <aside className={`${
        collapsed ? 'w-20' : 'w-64'
      } ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } bg-slate-900 text-white min-h-screen flex flex-col transition-all duration-300 ease-in-out shrink-0 border-r border-slate-800 fixed inset-y-0 left-0 z-50 md:relative md:flex`}>
      
      {/* Sidebar Header / Logo */}
      <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-slate-800/60 h-16`}>
        {!collapsed && (
          <h1 className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-emerald-400 tracking-tight animate-in fade-in duration-300">
            RestoFlow
          </h1>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shadow-md animate-in zoom-in duration-200">
            P
          </div>
        )}
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-none">
        
        {/* Dashboard */}
        <Link 
          href="/dashboard" 
          onClick={handleLinkClick}
          className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
          title={t('dashboard')}
        >
          <LayoutDashboard size={20} className="text-slate-300 shrink-0" />
          {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('dashboard')}</span>}
        </Link>
        
        {/* TRANSAKSI SECTION */}
        {collapsed ? (
          <div className="border-t border-slate-800/50 my-3" />
        ) : (
          <div className="pt-4 pb-1.5 px-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('appName')}</p>
          </div>
        )}
        
        {/* Kasir POS */}
        <Link 
          href="/pos" 
          onClick={handleLinkClick}
          className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200 text-emerald-400`}
          title={t('pos')}
        >
          <ShoppingCart size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold animate-in fade-in duration-200">{t('pos')}</span>}
        </Link>

        {/* Customer Orders */}
        <Link 
          href="/orders" 
          onClick={handleLinkClick}
          className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200 text-blue-400`}
          title={t('customerOrders')}
        >
          <ClipboardList size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold animate-in fade-in duration-200">{t('customerOrders')}</span>}
        </Link>

        {/* Riwayat Transaksi */}
        <Link 
          href="/history" 
          onClick={handleLinkClick}
          className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
          title={t('transactionsHistory')}
        >
          <History size={20} className="text-slate-300 shrink-0" />
          {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('transactionsHistory')}</span>}
        </Link>

        {/* MASTER DATA SECTION */}
        {isAdmin && (
          <>
            {collapsed ? (
              <div className="border-t border-slate-800/50 my-3" />
            ) : (
              <div className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Data</p>
              </div>
            )}

            {/* Produk */}
            <Link 
              href="/master/products" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('products')}
            >
              <Package size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('products')}</span>}
            </Link>

            {/* Pengguna */}
            <Link 
              href="/master/users" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200 text-blue-400`}
              title={t('users')}
            >
              <Users size={20} className="shrink-0" />
              {!collapsed && <span className="text-sm font-semibold animate-in fade-in duration-200">{t('users')}</span>}
            </Link>

            {/* Kategori */}
            <Link 
              href="/master/categories" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('categories')}
            >
              <Tag size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('categories')}</span>}
            </Link>

            {/* Master Meja */}
            <Link 
              href="/master/tables" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200 text-emerald-400`}
              title={t('tableManagement')}
            >
              <QrCode size={20} className="shrink-0" />
              {!collapsed && <span className="text-sm font-semibold animate-in fade-in duration-200">{t('tableManagement')}</span>}
            </Link>

            {/* Customer */}
            <Link 
              href="/master/customers" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('customers')}
            >
              <Users size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('customers')}</span>}
            </Link>

            {/* Supplier */}
            <Link 
              href="/master/suppliers" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('suppliers')}
            >
              <Truck size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('suppliers')}</span>}
            </Link>

            {/* OTHER SECTION */}
            {collapsed ? (
              <div className="border-t border-slate-800/50 my-3" />
            ) : (
              <div className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lainnya</p>
              </div>
            )}

            {/* Laporan */}
            <Link 
              href="/reports" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('reports')}
            >
              <FileText size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('reports')}</span>}
            </Link>

            {/* Pengaturan */}
            <Link 
              href="/settings" 
              onClick={handleLinkClick}
              className={`flex items-center ${collapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl hover:bg-slate-800/80 transition-all duration-200`}
              title={t('settings')}
            >
              <Settings size={20} className="text-slate-300 shrink-0" />
              {!collapsed && <span className="text-sm font-medium animate-in fade-in duration-200">{t('settings')}</span>}
            </Link>
          </>
        )}
      </nav>

      {/* User Footer profile details */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/20">
        <div className={`flex items-center ${collapsed ? 'flex-col space-y-3 justify-center' : 'justify-between'} p-2 rounded-xl bg-slate-800/40 border border-slate-850/50`}>
          <div className={`flex items-center ${collapsed ? 'flex-col text-center space-y-2' : 'space-x-2.5'} overflow-hidden`}>
            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-200 truncate leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-emerald-400 capitalize font-bold leading-none mt-0.5">{user?.role || 'kasir'}</p>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
            title={t('logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  </>
  );
}
