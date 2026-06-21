"use client";

import { useState, useEffect } from 'react';
import { Transaction, TransactionItem } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Search, Eye, FileText, X } from 'lucide-react';
import { Receipt } from '@/components/pos/Receipt';

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<{tx: Transaction, items: TransactionItem[]} | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(tx => 
    tx.no.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tx.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewDetail = async (tx: Transaction) => {
    if (!tx.id) return;
    
    try {
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transactionId', tx.id);

      if (error) throw error;

      setSelectedTx({ tx, items: data || [] });
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch transaction items:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Riwayat Transaksi</h1>
          <p className="text-slate-500 text-sm">Lihat dan cetak ulang struk transaksi sebelumnya.</p>
        </div>
        
        <div className="relative w-72">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari No. Transaksi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">No. Transaksi</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Metode Bayar</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <p>Memuat data...</p>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <FileText size={32} className="mx-auto mb-3 opacity-20" />
                    <p>Tidak ada riwayat transaksi ditemukan</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{tx.no}</td>
                    <td className="px-6 py-4 text-slate-600">{format(tx.date, 'dd MMM yyyy, HH:mm')}</td>
                    <td className="px-6 py-4 font-semibold text-blue-600">Rp {tx.total.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-slate-600">{tx.paymentMethod}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        tx.status === 'hold' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleViewDetail(tx)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium text-xs"
                      >
                        <Eye size={14} className="mr-1.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Receipt Modal */}
      {isDetailModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print:shadow-none print:w-full print:max-w-none print:rounded-none">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
              <h2 className="text-lg font-bold text-slate-800">Detail Transaksi</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[60vh] print:max-h-none print:overflow-visible">
              <Receipt transaction={selectedTx.tx} items={selectedTx.items} />
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-2 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 transition-colors flex justify-center items-center"
              >
                Cetak Ulang Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
