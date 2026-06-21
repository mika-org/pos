"use client";

import { Bell, Search, Wifi, WifiOff, Languages, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CustomerOrder } from '@/lib/db';

export function Header() {
  const [isOnline, setIsOnline] = useState(true);
  const { t, language, setLanguage } = useTranslation();
  const { toggleSidebarMobile } = useUiStore();
  const router = useRouter();
  const [pendingOrders, setPendingOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch pending customer orders and subscribe to realtime updates
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const { data, error } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('status', 'pending_confirmation')
          .order('created_at', { ascending: false });
        if (!error && data) {
          setPendingOrders(data);
        }
      } catch (err) {
        console.error('Failed to fetch pending orders:', err);
      }
    };

    fetchPending();

    const channel = supabase
      .channel('header-incoming-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as CustomerOrder;
            if (newOrder.status === 'pending_confirmation') {
              setPendingOrders(prev => [newOrder, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as CustomerOrder;
            if (updatedOrder.status !== 'pending_confirmation') {
              setPendingOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
            } else {
              setPendingOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            }
          } else if (payload.eventType === 'DELETE') {
            setPendingOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 transition-all duration-300">
      <div className="flex items-center space-x-3">
        {/* Mobile Hamburger menu */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebarMobile}
          className="md:hidden text-slate-600 hover:bg-slate-100 rounded-xl"
          title="Open Menu"
        >
          <Menu size={20} />
        </Button>

        {/* Search bar, hidden on mobile */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-80 lg:w-96 focus-within:ring-2 focus-within:ring-blue-400 focus-within:bg-white transition-all">
          <Search size={18} className="text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder={t('searchPlaceholder')} 
            className="bg-transparent border-none outline-none w-full text-sm text-slate-700"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
          {isOnline ? (
            <>
              <Wifi size={14} className="mr-1.5" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="mr-1.5" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Language Selector (Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center space-x-1.5 select-none font-semibold text-slate-750 border-slate-200">
              <Languages size={15} />
              <span>{language === 'id' ? 'ID' : 'EN'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border border-slate-100 shadow-lg rounded-xl min-w-[8rem]">
            <DropdownMenuItem onClick={() => setLanguage('id')} className={`cursor-pointer hover:bg-slate-50 ${language === 'id' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}>
              Bahasa Indonesia (ID)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')} className={`cursor-pointer hover:bg-slate-50 ${language === 'en' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}>
              English (EN)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Notification Bell (Dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-500 rounded-full relative hover:bg-slate-100 select-none">
              <Bell size={20} />
              {pendingOrders.length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-rose-650 text-white font-black text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-white animate-bounce">
                  {pendingOrders.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border border-slate-150 shadow-2xl rounded-2xl w-80 p-1.5 z-50">
            <div className="p-3 pb-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
              <h3 className="text-xs font-black text-slate-750 uppercase tracking-wider">Notifikasi Pesanan</h3>
              {pendingOrders.length > 0 && (
                <span className="text-[9px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-black">
                  {pendingOrders.length} Baru
                </span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto py-1 divide-y divide-slate-50">
              {pendingOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  Tidak ada pesanan baru dari meja.
                </div>
              ) : (
                pendingOrders.map((order) => {
                  const tableLabel = order.table_id ? `Meja ${order.table_id.replace('meja_', '')}` : 'Takeaway';
                  return (
                    <DropdownMenuItem
                      key={order.id}
                      onClick={() => router.push(`/orders?status=pending_confirmation&id=${order.id}`)}
                      className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors block text-left outline-none border-none"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          order.table_id ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tableLabel}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1.5 truncate">
                        {order.customer_name}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] font-mono text-slate-450 uppercase tracking-tight select-all">{order.id}</p>
                        <p className="text-xs font-black text-blue-600">
                          Rp {order.total_amount.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
            <div className="p-1 border-t border-slate-100 mt-1">
              <button
                onClick={() => router.push('/orders')}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-700 font-extrabold py-2 hover:bg-slate-50 rounded-xl transition-all block cursor-pointer"
              >
                Lihat Semua Pesanan
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
