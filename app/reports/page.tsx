"use client";

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Download, Search, FileText, TrendingUp, Tag, Banknote, RefreshCw } from 'lucide-react';
import { DateRangeFilter, DatePreset } from '@/components/ui/DateRangeFilter';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import { exportSalesReportExcel } from '@/lib/excelExport';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [preset, setPreset] = useState<DatePreset>('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [soldItems, setSoldItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filter logic with all-time guards
  const startTs = startDate ? startOfDay(new Date(startDate)).getTime() : 0;
  const endTs = endDate ? endOfDay(new Date(endDate)).getTime() : Date.now() * 2;

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        const [transactionsRes, customerOrdersRes, productsRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .gte('date', startTs)
            .lte('date', endTs)
            .eq('status', 'completed'),
          supabase
            .from('customer_orders')
            .select('*')
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .eq('status', 'finished'),
          supabase
            .from('products')
            .select('id, name')
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (customerOrdersRes.error) throw customerOrdersRes.error;

        const txs = transactionsRes.data || [];
        const cos = customerOrdersRes.data || [];
        const productsList = productsRes.data || [];

        setTransactions(txs);
        setCustomerOrders(cos);

        const productMap: Record<string, string> = {};
        productsList.forEach(p => {
          productMap[p.id] = p.name;
        });

        const txIds = txs.map(tx => tx.id);
        const orderIds = cos.map(co => co.id);

        let fetchedTxItems: any[] = [];
        let fetchedOrderItems: any[] = [];

        if (txIds.length > 0) {
          const { data, error } = await supabase
            .from('transaction_items')
            .select('*')
            .in('transactionId', txIds);
          if (!error && data) fetchedTxItems = data;
        }

        if (orderIds.length > 0) {
          const { data, error } = await supabase
            .from('customer_order_items')
            .select('*')
            .in('order_id', orderIds);
          if (!error && data) fetchedOrderItems = data;
        }

        const combinedItemsList = [
          ...fetchedTxItems.map(item => ({
            transactionId: item.transactionId,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            qty: Number(item.qty),
            discount: Number(item.discount || 0),
            subtotal: Number(item.subtotal),
            date: txs.find(tx => tx.id === item.transactionId)?.date || Date.now()
          })),
          ...fetchedOrderItems.map(item => ({
            transactionId: item.order_id,
            productId: item.product_id,
            productName: productMap[item.product_id] || 'Produk Tidak Dikenal',
            price: item.price,
            qty: Number(item.quantity),
            discount: 0,
            subtotal: item.subtotal,
            date: cos.find(co => co.id === item.order_id)?.created_at || Date.now()
          }))
        ];

        setSoldItems(combinedItemsList);
      } catch (err) {
        console.error('Error fetching reports data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [startDate, endDate]);

  // Combine transactions and customer self-orders/table orders
  const combinedItems = [
    ...transactions.map(tx => ({
      id: tx.id,
      no: tx.no,
      date: tx.date,
      subtotal: tx.subtotal,
      discount: tx.discount,
      total: tx.total,
      paymentMethod: tx.paymentMethod,
      type: 'POS Kasir'
    })),
    ...customerOrders.map(co => ({
      id: co.id,
      no: co.id,
      date: co.created_at,
      subtotal: co.total_amount, // Self orders don't store separate discount/subtotal field, total is subtotal
      discount: 0,
      total: co.total_amount,
      paymentMethod: co.payment_method === 'qris' ? 'QRIS' : co.payment_method === 'bank_transfer' ? 'Transfer Bank' : 'Bayar Kasir',
      type: co.table_id ? `Meja (${co.table_id.replace('meja_', 'Meja ')})` : 'Self-Order (Takeaway)'
    }))
  ].sort((a, b) => b.date - a.date); // Newest first

  // Summary Metrics
  const totalRevenue = combinedItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = combinedItems.reduce((sum, item) => sum + item.discount, 0);
  const totalSubtotal = combinedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const transactionCount = combinedItems.length;

  // Top Selling Products Calculation
  const productSalesMap: Record<string, { name: string; qty: number; totalSales: number }> = {};
  soldItems.forEach(item => {
    const key = item.productId;
    if (!productSalesMap[key]) {
      productSalesMap[key] = { name: item.productName, qty: 0, totalSales: 0 };
    }
    productSalesMap[key].qty += item.qty;
    productSalesMap[key].totalSales += item.subtotal;
  });

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Chart Data Calculations (Daily breakdown, up to 31 points)
  const chartData = [];
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffTime = Math.abs(endD.getTime() - startD.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Number of days

  const daysToRender = Math.min(diffDays, 31);
  for (let i = 0; i < daysToRender; i++) {
    const date = new Date(startTs + i * 24 * 60 * 60 * 1000);
    const start = startOfDay(date).getTime();
    const end = endOfDay(date).getTime();

    const dayRevenue =
      transactions
        .filter(tx => tx.date >= start && tx.date <= end)
        .reduce((sum, tx) => sum + tx.total, 0) +
      customerOrders
        .filter(co => co.created_at >= start && co.created_at <= end)
        .reduce((sum, co) => sum + co.total_amount, 0);

    chartData.push({
      name: format(date, 'dd MMM'),
      revenue: dayRevenue
    });
  }

  // Payment breakdown for chart
  const pmBreakdownTotals: Record<string, number> = {
    'QRIS': 0,
    'Transfer Bank': 0,
    'Bayar Kasir': 0,
    'Lainnya/Tunai': 0
  };

  combinedItems.forEach(item => {
    let method = item.paymentMethod || 'Lainnya/Tunai';
    if (method.toUpperCase().includes('QRIS')) method = 'QRIS';
    else if (method.toUpperCase().includes('TRANSFER') || method.toUpperCase().includes('BANK')) method = 'Transfer Bank';
    else if (method.toUpperCase().includes('KASIR') || method.toUpperCase().includes('CASHIER')) method = 'Bayar Kasir';
    else method = 'Lainnya/Tunai';

    pmBreakdownTotals[method] += item.total;
  });

  const paymentChartData = Object.entries(pmBreakdownTotals)
    .filter(([_, value]) => value > 0)
    .map(([name, value], idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#64748b']; // blue, emerald, amber, slate
      return { name, value, color: colors[idx % colors.length] };
    });

  // Export to Excel
  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      await exportSalesReportExcel(combinedItems, startDate, endDate, soldItems, {
        totalSubtotal,
        totalDiscount,
        totalRevenue,
        transactionCount
      });
    } catch (err) {
      console.error('Gagal mengekspor ke Excel:', err);
      toast.error('Gagal mengekspor ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Penjualan</h1>
          <p className="text-slate-500 text-sm">Lihat ringkasan dan unduh data transaksi.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            selectedPreset={preset}
            onChange={(start, end, pr) => { setStartDate(start); setEndDate(end); setPreset(pr); }}
            showAllTime={true}
          />
          <button
            onClick={exportToExcel}
            disabled={combinedItems.length === 0 || isExporting}
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <TrendingUp size={18} className="text-blue-500" />
            <span className="font-medium text-sm">Total Penjualan Kotor</span>
          </div>
          <span className="text-2xl font-bold text-slate-800">Rp {totalSubtotal.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <Tag size={18} className="text-rose-500" />
            <span className="font-medium text-sm">Total Diskon</span>
          </div>
          <span className="text-2xl font-bold text-rose-500">- Rp {totalDiscount.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <Banknote size={18} className="text-emerald-500" />
            <span className="font-medium text-sm">Total Pendapatan Bersih</span>
          </div>
          <span className="text-2xl font-bold text-emerald-600">Rp {totalRevenue.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <FileText size={18} className="text-purple-500" />
            <span className="font-medium text-sm">Jumlah Transaksi</span>
          </div>
          <span className="text-2xl font-bold text-slate-800">{transactionCount} Transaksi</span>
        </div>
      </div>

      {/* Recharts Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Tren Pendapatan Harian</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Analisis tren omzet selama rentang tanggal terpilih</p>
          </div>
          <div className="flex-1 w-full min-h-[250px] min-w-0 relative">
            {chartData.length === 0 || chartData.every(d => d.revenue === 0) ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-semibold">
                Belum ada data penjualan pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenueReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                    tickFormatter={(val) => `Rp ${(val / 1000)}k`}
                    dx={-10}
                  />
                  <Tooltip
                    formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontFamily: 'inherit', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueReports)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown Pie Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Metode Pembayaran</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Perbandingan omzet per metode bayar</p>
          </div>
          <div className="flex-1 w-full min-h-[220px] min-w-0 relative flex items-center justify-center">
            {paymentChartData.length === 0 ? (
              <div className="text-slate-400 text-xs font-semibold text-center py-10">
                Tidak ada data metode pembayaran.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
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
                    formatter={(value) => <span className="text-[11px] font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Products & Order Source Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Products Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Top 5 Produk Terlaris</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Produk dengan kuantitas penjualan tertinggi</p>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">Memuat data produk...</div>
          ) : topProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">Belum ada data produk terjual.</div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, idx) => {
                const maxQty = topProducts[0]?.qty || 1;
                const percentage = (p.qty / maxQty) * 100;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">{idx + 1}. {p.name}</span>
                      <span className="text-slate-500">{p.qty}x terjual <span className="text-slate-350 font-normal">|</span> Rp {p.totalSales.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-550 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Channel & Statistics Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Statistik Penjualan</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Rangkuman performa operasional</p>
          </div>
          <div className="space-y-4 divide-y divide-slate-100 text-xs font-bold text-slate-650">
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500">Rata-rata Per Transaksi</span>
              <span className="text-slate-800 font-extrabold text-sm">
                Rp {transactionCount > 0 ? Math.round(totalRevenue / transactionCount).toLocaleString('id-ID') : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500">Omzet POS Kasir</span>
              <span className="text-slate-800">
                Rp {combinedItems.filter(item => item.type === 'POS Kasir').reduce((sum, i) => sum + i.total, 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500">Omzet Self-Order / Meja</span>
              <span className="text-slate-800">
                Rp {combinedItems.filter(item => item.type !== 'POS Kasir').reduce((sum, i) => sum + i.total, 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500">Rasio Self-Order / Meja</span>
              <span className="text-blue-600 font-extrabold">
                {transactionCount > 0 
                  ? `${Math.round((combinedItems.filter(item => item.type !== 'POS Kasir').length / transactionCount) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Detail Transaksi (Selesai)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">No. Transaksi</th>
                <th className="px-6 py-3 font-medium">Tanggal</th>
                <th className="px-6 py-3 font-medium">Tipe / Sumber</th>
                <th className="px-6 py-3 font-medium">Subtotal</th>
                <th className="px-6 py-3 font-medium">Diskon</th>
                <th className="px-6 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : combinedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data transaksi pada rentang tanggal tersebut.
                  </td>
                </tr>
              ) : (
                combinedItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800 select-all uppercase text-xs tracking-wider">{item.no}</td>
                    <td className="px-6 py-3 text-slate-600">{format(item.date, 'dd MMM yyyy, HH:mm')}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${item.type.includes('Meja') ? 'bg-blue-100 text-blue-800' :
                        item.type.includes('Takeaway') ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">Rp {item.subtotal.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 text-rose-500">Rp {item.discount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 font-bold text-emerald-600">Rp {item.total.toLocaleString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
