"use client";

import { DollarSign, ShoppingBag, TrendingUp, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { startOfDay, format, subDays } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const items = useLiveQuery(() => db.transactionItems.toArray()) || [];

  const today = startOfDay(new Date()).getTime();

  // Metrics
  const todayRevenue = transactions
    .filter(tx => tx.date >= today && tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.total, 0);

  const todaySalesCount = transactions
    .filter(tx => tx.date >= today && tx.status === 'completed')
    .length;

  const lowStockProducts = products.filter(p => !p.deleted && p.stock <= 5).length;

  let bestSellingProduct = '-';
  if (items.length > 0) {
    const productSales: Record<string, number> = {};
    items.forEach(item => {
      productSales[item.productName] = (productSales[item.productName] || 0) + item.qty;
    });
    
    let maxQty = 0;
    for (const [name, qty] of Object.entries(productSales)) {
      if (qty > maxQty) {
        maxQty = qty;
        bestSellingProduct = name;
      }
    }
  }

  // Chart Data (Last 7 Days)
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const start = startOfDay(date).getTime();
    const end = start + 86400000;
    
    const dayRevenue = transactions
      .filter(tx => tx.date >= start && tx.date < end && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.total, 0);
      
    chartData.push({
      name: format(date, 'dd MMM'),
      revenue: dayRevenue
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Pendapatan Hari Ini</p>
            <p className="text-2xl font-bold text-slate-800">Rp {todayRevenue.toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Penjualan Hari Ini</p>
            <p className="text-2xl font-bold text-slate-800">{todaySalesCount} Transaksi</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Produk Terlaris</p>
            <p className="text-xl font-bold text-slate-800 line-clamp-1" title={bestSellingProduct}>{bestSellingProduct}</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Stok Menipis</p>
            <p className="text-2xl font-bold text-slate-800">{lowStockProducts} Produk</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 h-96 flex flex-col">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Grafik Pendapatan (7 Hari Terakhir)</h2>
        <div className="flex-1 w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                tickFormatter={(val) => `Rp ${(val/1000)}k`} 
                dx={-10}
              />
              <Tooltip 
                formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
