"use client";

import Link from 'next/link';
import { 
  LayoutDashboard, ShoppingCart, Users, Package, FileText, Settings, 
  History, Tag, LogOut, ClipboardList, QrCode, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useUiStore();
  const pathname = usePathname();
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

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const getLinkClass = (href: string) => {
    const active = isActive(href);
    if (active) {
      return `flex items-center ${
        collapsed ? 'justify-center py-3 px-0' : 'space-x-3 p-3'
      } rounded-xl bg-slate-800 text-white font-black border-l-3 border-blue-500 shadow-inner transition-all duration-250 select-none`;
    }
    return `flex items-center ${
      collapsed ? 'justify-center py-3 px-0' : 'space-x-3 p-3'
    } rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/40 hover:translate-x-0.5 transition-all duration-200 select-none`;
  };

  const getIconClass = (href: string, baseColor: string) => {
    const active = isActive(href);
    return `shrink-0 w-5 h-5 ${active ? 'text-blue-400' : baseColor}`;
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
      } bg-slate-950 text-white min-h-screen flex flex-col transition-all duration-300 ease-in-out shrink-0 border-r border-slate-900 fixed inset-y-0 left-0 z-50 md:relative md:flex`}>
      
        {/* Sidebar Header / Logo */}
        <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-slate-900/60 h-16 shrink-0`}>
          {!collapsed ? (
            <div className="flex items-center space-x-2.5 animate-in fade-in duration-300">
              {/* Elegant Cutlery Cloche SVG Logo */}
              <svg className="w-6 h-6 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2050/svg">
                <path d="M3 17C3 11 8 6 12 6C16 6 21 11 21 17H3Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M12 6V3M10 3H14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M2 20H22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M6 11.5C8 10 10 12.5 12 11C14 9.5 16 12 18 10.5" stroke="url(#flowGradient)" strokeWidth="1.8" strokeLinecap="round" />
                <defs>
                  <linearGradient id="flowGradient" x1="6" y1="10" x2="18" y2="11" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60A5FA" />
                    <stop offset="1" stopColor="#34D399" />
                  </linearGradient>
                </defs>
              </svg>
              <h1 className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wider">
                RestoFlow
              </h1>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-extrabold text-blue-400 text-sm shadow-md animate-in zoom-in duration-200">
              <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17C3 11 8 6 12 6C16 6 21 11 21 17H3Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M2 20H22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
          )}
          
          <button 
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
          
          {/* Dashboard */}
          <Link 
            href="/dashboard" 
            onClick={handleLinkClick}
            className={getLinkClass('/dashboard')}
            title={t('dashboard')}
          >
            <LayoutDashboard className={getIconClass('/dashboard', 'text-slate-400')} size={18} />
            {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('dashboard')}</span>}
          </Link>
          
          {/* TRANSAKSI SECTION */}
          {collapsed ? (
            <div className="border-t border-slate-900/60 my-3" />
          ) : (
            <div className="pt-4 pb-1 px-3">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transaksi</p>
            </div>
          )}
          
          {/* Kasir POS */}
          <Link 
            href="/pos" 
            onClick={handleLinkClick}
            className={getLinkClass('/pos')}
            title={t('pos')}
          >
            <ShoppingCart className={getIconClass('/pos', 'text-slate-450')} size={18} />
            {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('pos')}</span>}
          </Link>

          {/* Customer Orders */}
          <Link 
            href="/orders" 
            onClick={handleLinkClick}
            className={getLinkClass('/orders')}
            title={t('customerOrders')}
          >
            <ClipboardList className={getIconClass('/orders', 'text-slate-450')} size={18} />
            {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('customerOrders')}</span>}
          </Link>

          {/* Riwayat Transaksi */}
          <Link 
            href="/history" 
            onClick={handleLinkClick}
            className={getLinkClass('/history')}
            title={t('transactionsHistory')}
          >
            <History className={getIconClass('/history', 'text-slate-450')} size={18} />
            {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('transactionsHistory')}</span>}
          </Link>

          {/* MASTER DATA SECTION */}
          {isAdmin && (
            <>
              {collapsed ? (
                <div className="border-t border-slate-900/60 my-3" />
              ) : (
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Master Data</p>
                </div>
              )}

              {/* Produk */}
              <Link 
                href="/master/products" 
                onClick={handleLinkClick}
                className={getLinkClass('/master/products')}
                title={t('products')}
              >
                <Package className={getIconClass('/master/products', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('products')}</span>}
              </Link>

              {/* Pengguna */}
              <Link 
                href="/master/users" 
                onClick={handleLinkClick}
                className={getLinkClass('/master/users')}
                title={t('users')}
              >
                <Users className={getIconClass('/master/users', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('users')}</span>}
              </Link>

              {/* Kategori */}
              <Link 
                href="/master/categories" 
                onClick={handleLinkClick}
                className={getLinkClass('/master/categories')}
                title={t('categories')}
              >
                <Tag className={getIconClass('/master/categories', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('categories')}</span>}
              </Link>

              {/* Master Meja */}
              <Link 
                href="/master/tables" 
                onClick={handleLinkClick}
                className={getLinkClass('/master/tables')}
                title={t('tableManagement')}
              >
                <QrCode className={getIconClass('/master/tables', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('tableManagement')}</span>}
              </Link>

              {/* OTHER SECTION */}
              {collapsed ? (
                <div className="border-t border-slate-900/60 my-3" />
              ) : (
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Lainnya</p>
                </div>
              )}

              {/* Laporan */}
              <Link 
                href="/reports" 
                onClick={handleLinkClick}
                className={getLinkClass('/reports')}
                title={t('reports')}
              >
                <FileText className={getIconClass('/reports', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('reports')}</span>}
              </Link>

              {/* Pengaturan */}
              <Link 
                href="/settings" 
                onClick={handleLinkClick}
                className={getLinkClass('/settings')}
                title={t('settings')}
              >
                <Settings className={getIconClass('/settings', 'text-slate-450')} size={18} />
                {!collapsed && <span className="text-xs font-semibold animate-in fade-in duration-200">{t('settings')}</span>}
              </Link>
            </>
          )}
        </nav>

        {/* User Footer profile details */}
        <div className="p-3 border-t border-slate-900 bg-slate-950/40 shrink-0">
          <div className={`flex items-center ${collapsed ? 'flex-col space-y-3 justify-center' : 'justify-between'} p-2 rounded-2xl bg-slate-900/40 border border-slate-900 shadow-lg`}>
            <div className={`flex items-center ${collapsed ? 'flex-col text-center space-y-2' : 'space-x-2.5'} overflow-hidden`}>
              <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner relative">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
              </div>
              {!collapsed && (
                <div className="overflow-hidden text-left">
                  <p className="text-xs font-bold text-slate-200 truncate leading-tight">{user?.name || 'User'}</p>
                  <p className="text-[9px] text-blue-400 capitalize font-bold leading-none mt-1">{user?.role || 'kasir'}</p>
                </div>
              )}
            </div>
            <button 
              onClick={logout}
              className={`p-1.5 rounded-lg text-slate-455 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
              title={t('logout')}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
