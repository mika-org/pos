"use client";

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Download, Search, FileText, TrendingUp, Tag, Banknote } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter logic
  const startTs = startOfDay(new Date(startDate)).getTime();
  const endTs = endOfDay(new Date(endDate)).getTime();

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        const [transactionsRes, customerOrdersRes] = await Promise.all([
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
            .eq('status', 'finished')
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (customerOrdersRes.error) throw customerOrdersRes.error;

        setTransactions(transactionsRes.data || []);
        setCustomerOrders(customerOrdersRes.data || []);
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
      paymentMethod: co.payment_method === 'qris' ? 'QRIS' : 'Transfer Bank',
      type: co.table_id ? `Meja (${co.table_id.replace('meja_', 'Meja ')})` : 'Self-Order (Takeaway)'
    }))
  ].sort((a, b) => b.date - a.date); // Newest first

  // Summary Metrics
  const totalRevenue = combinedItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = combinedItems.reduce((sum, item) => sum + item.discount, 0);
  const totalSubtotal = combinedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const transactionCount = combinedItems.length;

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const reportDateStr = startDate === endDate 
      ? format(new Date(startDate), 'dd MMMM yyyy')
      : `${format(new Date(startDate), 'dd MMMM yyyy')} - ${format(new Date(endDate), 'dd MMMM yyyy')}`;

    const data: any[][] = [
      ['LAPORAN PENJUALAN - RESTOFLOW POS'],
      ['Periode:', reportDateStr],
      ['Tanggal Ekspor:', format(new Date(), 'dd MMMM yyyy HH:mm:ss')],
      [],
      ['RINGKASAN LAPORAN'],
      ['Total Penjualan Kotor (Subtotal)', totalSubtotal],
      ['Total Diskon', totalDiscount],
      ['Total Pendapatan Bersih', totalRevenue],
      ['Jumlah Transaksi', transactionCount],
      [],
      ['No. Transaksi', 'Tanggal & Waktu', 'Tipe / Sumber', 'Subtotal (Rp)', 'Diskon (Rp)', 'Total (Rp)', 'Metode Bayar'],
    ];

    combinedItems.forEach(item => {
      data.push([
        item.no.toUpperCase(),
        format(item.date, 'yyyy-MM-dd HH:mm:ss'),
        item.type,
        item.subtotal,
        item.discount,
        item.total,
        item.paymentMethod
      ]);
    });

    data.push([]);
    data.push([
      'GRAND TOTAL',
      '',
      '',
      totalSubtotal,
      totalDiscount,
      totalRevenue,
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
    ];

    const currencyFormat = '"Rp"#,##0;("Rp"#,##0);"-"';
    const integerFormat = '#,##0';

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const colWidths = [18, 22, 22, 16, 14, 16, 16];

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        const cell = ws[cell_ref];

        if (!cell) continue;

        const cellValueString = cell.v ? String(cell.v) : '';
        if (cellValueString.length + 4 > colWidths[C]) {
          colWidths[C] = cellValueString.length + 4;
        }

        if (R >= 5 && R <= 8) {
          if (C === 1 && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = R === 8 ? integerFormat : currencyFormat;
          }
        }

        if (R >= 11 && R < 11 + combinedItems.length) {
          if ((C === 3 || C === 4 || C === 5) && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = currencyFormat;
          }
        }

        if (R === 11 + combinedItems.length + 1) {
          if ((C === 3 || C === 4 || C === 5) && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = currencyFormat;
          }
        }
      }
    }

    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

    const s2ab = (s: string) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xFF;
      }
      return buf;
    };

    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Penjualan_${startDate}_sd_${endDate}.xlsx`);
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
            onClick={exportToExcel}
            disabled={combinedItems.length === 0}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            <span>Export Excel</span>
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
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        item.type.includes('Meja') ? 'bg-blue-100 text-blue-800' :
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
