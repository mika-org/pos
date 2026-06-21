"use client";

import { Bell, Search, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Header() {
  const [isOnline, setIsOnline] = useState(true);

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

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 transition-all duration-300">
      <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 w-96 focus-within:ring-2 focus-within:ring-blue-400 focus-within:bg-white transition-all">
        <Search size={18} className="text-slate-400 mr-2" />
        <input 
          type="text" 
          placeholder="Cari transaksi, produk, atau fitur..." 
          className="bg-transparent border-none outline-none w-full text-sm text-slate-700"
        />
      </div>

      <div className="flex items-center space-x-4">
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
        
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
}
