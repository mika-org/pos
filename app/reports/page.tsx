"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Download, Search, FileText, TrendingUp, Tag, Banknote } from 'lucide-react';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  // Filter logic
  const startTs = startOfDay(new Date(startDate)).getTime();
  const endTs = endOfDay(new Date(endDate)).getTime();

  const filteredTransactions = transactions
    .filter(tx => tx.date >= startTs && tx.date <= endTs && tx.status === 'completed')
    .sort((a, b) => b.date - a.date); // Newest first

  // Summary Metrics
  const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalDiscount = filteredTransactions.reduce((sum, tx) => sum + tx.discount, 0);
  const totalSubtotal = filteredTransactions.reduce((sum, tx) => sum + tx.subtotal, 0);
  const transactionCount = filteredTransactions.length;

  const exportToCSV = () => {
    const headers = ['No. Transaksi', 'Tanggal', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar', 'Status'];
    const rows = filteredTransactions.map(tx => [
      tx.no,
      format(tx.date, 'yyyy-MM-dd HH:mm:ss'),
      tx.subtotal,
      tx.discount,
      tx.total,
      tx.paymentMethod,
      tx.status
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_penjualan_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Penjualan</h1>
          <p className="text-slate-500 text-sm">Lihat ringkasan dan unduh data transaksi.</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

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
          <span className="text-2xl font-bold text-slate-800 text-rose-500">- Rp {totalDiscount.toLocaleString('id-ID')}</span>
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
                <th className="px-6 py-3 font-medium">Subtotal</th>
                <th className="px-6 py-3 font-medium">Diskon</th>
                <th className="px-6 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data transaksi pada rentang tanggal tersebut.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">{tx.no}</td>
                    <td className="px-6 py-3 text-slate-600">{format(tx.date, 'dd MMM yyyy, HH:mm')}</td>
                    <td className="px-6 py-3 text-slate-600">Rp {tx.subtotal.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 text-rose-500">Rp {tx.discount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 font-bold text-emerald-600">Rp {tx.total.toLocaleString('id-ID')}</td>
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
