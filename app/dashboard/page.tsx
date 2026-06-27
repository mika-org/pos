"use client";

import { 
  DollarSign, ShoppingBag, TrendingUp, AlertCircle, 
  Layers, Award, ClipboardList, Clock, ArrowRight, UserCheck 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Transaction, Product, TransactionItem, Category } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { startOfDay, format, subDays, endOfDay } from 'date-fns';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/stores/languageStore';
import { DateRangeFilter, DatePreset } from '@/components/ui/DateRangeFilter';
import Link from 'next/link';

export default function Dashboard() {
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [preset, setPreset] = useState<DatePreset>('last30Days');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerOrderItems, setCustomerOrderItems] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const { user } = useAuthStore();
  const { t, language } = useTranslation();

  // Clock Effect
  useEffect(() => {
    setCurrentTime(new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }));
  }, []);

  // Fetch Dashboard Data Effect
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const startTs = startOfDay(new Date(startDate)).getTime();
        const endTs = endOfDay(new Date(endDate)).getTime();

        const [
          productsRes, 
          transactionsRes, 
          itemsRes, 
          customerOrdersRes, 
          customerOrderItemsRes, 
          activeOrdersRes, 
          categoriesRes
        ] = await Promise.all([
          supabase.from('products').select('*').eq('deleted', false),
          supabase.from('transactions').select('*').gte('date', startTs).lte('date', endTs),
          supabase.from('transaction_items').select('*').limit(1000),
          supabase.from('customer_orders').select('*').eq('status', 'finished').gte('created_at', startTs).lte('created_at', endTs),
          supabase.from('customer_order_items').select('*').limit(1000),
          supabase.from('customer_orders').select('*').in('status', ['pending_confirmation', 'preparing', 'delivery']).order('created_at', { ascending: false }).limit(5),
          supabase.from('categories').select('*').eq('deleted', false)
        ]);

        setProducts(productsRes.data || []);
        setTransactions(transactionsRes.data || []);
        setItems(itemsRes.data || []);
        setCustomerOrders(customerOrdersRes.data || []);
        setCustomerOrderItems(customerOrderItemsRes.data || []);
        setActiveOrders(activeOrdersRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [startDate, endDate]);

  // Labels helper for period metrics
  const getRevenueLabel = () => {
    if (language === 'en') {
      return preset === 'today' ? "Today's Revenue" : preset === 'yesterday' ? "Yesterday's Revenue" : "Revenue in Period";
    }
    return preset === 'today' ? "Pendapatan Hari Ini" : preset === 'yesterday' ? "Pendapatan Kemarin" : "Pendapatan Periode Ini";
  };

  const getSalesLabel = () => {
    if (language === 'en') {
      return preset === 'today' ? "Today's Sales" : preset === 'yesterday' ? "Yesterday's Sales" : "Sales in Period";
    }
    return preset === 'today' ? "Penjualan Hari Ini" : preset === 'yesterday' ? "Penjualan Kemarin" : "Penjualan Periode Ini";
  };

  const getBestProductLabel = () => {
    if (language === 'en') {
      return preset === 'today' ? "Today's Best Seller" : preset === 'yesterday' ? "Yesterday's Best Seller" : "Best Seller in Period";
    }
    return preset === 'today' ? "Produk Terlaris" : preset === 'yesterday' ? "Produk Terlaris Kemarin" : "Produk Terlaris Periode Ini";
  };

  // Metrics (filtered in query now, so we just aggregate)
  const periodRevenue = 
    transactions
      .filter(tx => tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.total, 0) +
    customerOrders
      .filter(co => co.status === 'finished')
      .reduce((sum, co) => sum + co.total_amount, 0);

  const periodSalesCount = 
    transactions.filter(tx => tx.status === 'completed').length +
    customerOrders.filter(co => co.status === 'finished').length;

  const lowStockProducts = products.filter(p => !p.deleted && p.stock <= 5).length;

  // Active Transaction & Order IDs for accurate items filtering
  const activeTxIds = new Set(transactions.filter(t => t.status === 'completed').map(t => t.id));
  const activeOrderIds = new Set(customerOrders.filter(co => co.status === 'finished').map(co => co.id));

  let bestSellingProduct = '-';
  const matchingItems = items.filter(item => activeTxIds.has(item.transactionId));
  const matchingOrderItems = customerOrderItems.filter(item => activeOrderIds.has(item.order_id));

  if (matchingItems.length > 0 || matchingOrderItems.length > 0) {
    const productSales: Record<string, number> = {};
    matchingItems.forEach(item => {
      productSales[item.productName] = (productSales[item.productName] || 0) + item.qty;
    });
    matchingOrderItems.forEach(item => {
      const prodName = products.find(p => p.id === item.product_id)?.name || 'Unknown Product';
      productSales[prodName] = (productSales[prodName] || 0) + item.quantity;
    });
    
    let maxQty = 0;
    for (const [name, qty] of Object.entries(productSales)) {
      if (qty > maxQty) {
        maxQty = qty;
        bestSellingProduct = name;
      }
    }
  }

  // Chart Data Calculations (Dynamic based on selected period range)
  const chartData = [];
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffTime = Math.abs(endD.getTime() - startD.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Number of days (e.g. 1, 7, 30)

  if (diffDays <= 1) {
    // Single-day breakdown: show 2-hourly sales flow
    for (let hour = 8; hour <= 22; hour += 2) {
      const intervalStart = new Date(startDate);
      intervalStart.setHours(hour, 0, 0, 0);
      const intervalEnd = new Date(startDate);
      intervalEnd.setHours(hour + 2, 0, 0, 0);
      
      const intervalRevenue = 
        transactions
          .filter(tx => tx.date >= intervalStart.getTime() && tx.date < intervalEnd.getTime() && tx.status === 'completed')
          .reduce((sum, tx) => sum + tx.total, 0) +
        customerOrders
          .filter(co => co.created_at >= intervalStart.getTime() && co.created_at < intervalEnd.getTime() && co.status === 'finished')
          .reduce((sum, co) => sum + co.total_amount, 0);
          
      chartData.push({
        name: `${String(hour).padStart(2, '0')}:00`,
        revenue: intervalRevenue
      });
    }
  } else {
    // Multi-day breakdown: show daily points (max 31 days to avoid crowding)
    const daysToRender = Math.min(diffDays, 31);
    const startTs = startOfDay(startD).getTime();
    for (let i = 0; i < daysToRender; i++) {
      const date = new Date(startTs + i * 24 * 60 * 60 * 1000);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      
      const dayRevenue = 
        transactions
          .filter(tx => tx.date >= start && tx.date <= end && tx.status === 'completed')
          .reduce((sum, tx) => sum + tx.total, 0) +
        customerOrders
          .filter(co => co.created_at >= start && co.created_at <= end && co.status === 'finished')
          .reduce((sum, co) => sum + co.total_amount, 0);
        
      chartData.push({
        name: format(date, 'dd MMM'),
        revenue: dayRevenue
      });
    }
  }

  // Donut Chart data: POS vs Meja
  const posRevenue = transactions
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.total, 0);
  const mejaRevenue = customerOrders
    .filter(co => co.status === 'finished')
    .reduce((sum, co) => sum + co.total_amount, 0);
  
  const sourceData = [
    { name: 'POS Kasir', value: posRevenue || 0, color: '#3b82f6' },
    { name: 'Pesanan Meja', value: mejaRevenue || 0, color: '#10b981' }
  ];

  // Top Selling Products Calculations
  const productAgg: Record<string, { name: string; category: string; qty: number; revenue: number }> = {};
  
  matchingItems.forEach(item => {
    const prod = products.find(p => p.name === item.productName || p.id === item.productId);
    const catName = categories.find(c => c.id === prod?.categoryId)?.name || 'Makanan';
    
    if (!productAgg[item.productId]) {
      productAgg[item.productId] = { name: item.productName, category: catName, qty: 0, revenue: 0 };
    }
    productAgg[item.productId].qty += item.qty;
    productAgg[item.productId].revenue += item.subtotal;
  });

  matchingOrderItems.forEach(item => {
    const prod = products.find(p => p.id === item.product_id);
    if (!prod) return;
    const catName = categories.find(c => c.id === prod.categoryId)?.name || 'Makanan';

    if (!productAgg[item.product_id]) {
      productAgg[item.product_id] = { name: prod.name, category: catName, qty: 0, revenue: 0 };
    }
    productAgg[item.product_id].qty += item.quantity;
    productAgg[item.product_id].revenue += item.subtotal;
  });

  const topProducts = Object.values(productAgg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_confirmation':
        return <span className="px-2 py-0.5 bg-yellow-55 border border-yellow-200 text-yellow-750 text-[10px] font-black rounded-md animate-pulse">Konfirmasi</span>;
      case 'preparing':
        return <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black rounded-md">Dapur</span>;
      case 'delivery':
        return <span className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-black rounded-md">Kirim</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-black rounded-md">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 font-semibold space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">Memuat data dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden bg-linear-to-r from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-lg border border-slate-700/30">
        <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center">
              <span>Selamat Datang Kembali, </span>
              <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-emerald-400 pl-1.5">{user?.name || 'Kasir'}</span>!
            </h2>
            <p className="text-xs md:text-sm text-slate-350 font-semibold max-w-xl leading-relaxed">
              Semua sistem berjalan normal. Pantau analisis transaksi, pesanan aktif dari meja pelanggan, dan performa menu terpopuler hari ini.
            </p>
          </div>
          <div className="shrink-0 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl flex flex-col md:text-right">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Waktu Server</span>
            <span className="text-xs font-black text-slate-100 mt-1">{currentTime}</span>
            <span className="text-[10px] text-emerald-400 font-bold mt-1">● Connected to Supabase</span>
          </div>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight">Recap & Ringkasan Performa</h3>
          <p className="text-[11px] text-slate-450 font-bold mt-0.5">Filter data transaksi untuk memperbarui metrik dan grafik.</p>
        </div>
        <DateRangeFilter 
          startDate={startDate} 
          endDate={endDate} 
          selectedPreset={preset} 
          onChange={(start, end, pr) => { setStartDate(start); setEndDate(end); setPreset(pr); }}
          showAllTime={false}
        />
      </div>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Today's Revenue */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-55 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <DollarSign size={22} className="stroke-2" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 font-black uppercase tracking-wider">{getRevenueLabel()}</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">Rp {periodRevenue.toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* Card 2: Today's Sales Count */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShoppingBag size={20} className="stroke-2" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 font-black uppercase tracking-wider">{getSalesLabel()}</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{periodSalesCount} Transaksi</p>
          </div>
        </div>

        {/* Card 3: Best Selling Product */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <TrendingUp size={20} className="stroke-2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-450 font-black uppercase tracking-wider">{getBestProductLabel()}</p>
            <p className="text-sm font-black text-slate-800 mt-1 line-clamp-1" title={bestSellingProduct}>{bestSellingProduct}</p>
          </div>
        </div>

        {/* Card 4: Low Stock Alert */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertCircle size={20} className="stroke-2" />
          </div>
          <div>
            <p className="text-[10px] text-slate-450 font-black uppercase tracking-wider">Stok Menipis</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{lowStockProducts} Produk</p>
          </div>
        </div>
      </div>

      {/* Charts Layout (Grid Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend AreaChart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">Tren Pendapatan Harian</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Analisis omzet gabungan kasir & meja dalam 7 hari terakhir</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[300px] min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} 
                  tickFormatter={(val) => `Rp ${(val/1000)}k`} 
                  dx={-10}
                />
                <Tooltip 
                  formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontFamily: 'inherit', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Shares PieChart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">Sumber Transaksi</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Perbandingan omzet POS vs Pesanan Meja</p>
          </div>
          <div className="flex-1 w-full min-h-[220px] min-w-0 relative flex items-center justify-center mt-4">
            {(posRevenue === 0 && mejaRevenue === 0) ? (
              <div className="text-slate-400 text-xs font-semibold text-center py-10">Belum ada transaksi terekam bulan ini.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={sourceData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontSize: '11px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between text-center text-xs font-bold text-slate-650">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-black">POS Kasir</p>
              <p className="text-blue-650 mt-0.5">Rp {posRevenue.toLocaleString('id-ID')}</p>
            </div>
            <div className="border-r border-slate-200"></div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-black">Pesanan Meja</p>
              <p className="text-emerald-600 mt-0.5">Rp {mejaRevenue.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Lists: Top Selling Products and Active Table Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products Table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
          <div className="flex items-center space-x-2.5 mb-5">
            <Award className="text-amber-500" size={18} />
            <h2 className="text-base font-black text-slate-800 tracking-tight">Menu Terlaris (Top 5)</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 font-semibold">Belum ada riwayat menu terjual.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-semibold">
                <thead>
                  <tr className="border-b border-slate-150 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-1">Nama Menu</th>
                    <th className="pb-3">Kategori</th>
                    <th className="pb-3 text-center">Porsi Terjual</th>
                    <th className="pb-3 text-right">Total Pendapatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {topProducts.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-bold text-slate-800 pl-1">{prod.name}</td>
                      <td className="py-3">
                        <span className="bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-md">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3 text-center font-black text-slate-800">{prod.qty}</td>
                      <td className="py-3 text-right font-black text-blue-600">Rp {prod.revenue.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Active Customer Table Orders */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center space-x-2.5">
              <ClipboardList className="text-blue-500" size={18} />
              <h2 className="text-base font-black text-slate-800 tracking-tight">Pesanan Meja Aktif</h2>
            </div>
            <Link 
              href="/orders" 
              className="text-xs text-blue-600 hover:text-blue-700 font-extrabold flex items-center space-x-1 transition-all"
            >
              <span>Semua Pesanan</span>
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="flex-1 divide-y divide-slate-100">
            {activeOrders.length === 0 ? (
              <p className="text-xs text-slate-450 italic text-center py-10 font-semibold">Tidak ada pesanan meja aktif saat ini.</p>
            ) : (
              activeOrders.map((order) => {
                const tableLabel = order.table_id ? `Meja ${order.table_id.replace('meja_', '')}` : 'Takeaway';
                return (
                  <div key={order.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-800 text-sm">{order.customer_name}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          order.table_id ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tableLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-455 font-mono mt-1 uppercase select-all">{order.id} | Rp {order.total_amount.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(order.status)}
                      <Link 
                        href={`/orders?status=${order.status}&id=${order.id}`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider select-none text-center"
                      >
                        Verifikasi
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
