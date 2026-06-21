"use client";

import { useState, useEffect } from 'react';
import { Transaction, TransactionItem } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Search, Eye, FileText, X } from 'lucide-react';
import { Receipt } from '@/components/pos/Receipt';

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'pos' | 'meja'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<{tx: Transaction, items: TransactionItem[]} | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistoryData = async () => {
    setIsLoading(true);
    try {
      const [transactionsRes, customerOrdersRes, tablesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false }),
        supabase
          .from('customer_orders')
          .select('*')
          .eq('status', 'finished')
          .order('created_at', { ascending: false }),
        supabase
          .from('tables')
          .select('*')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (customerOrdersRes.error) throw customerOrdersRes.error;

      setTransactions(transactionsRes.data || []);
      setCustomerOrders(customerOrdersRes.data || []);
      setTables(tablesRes.data || []);
    } catch (err) {
      console.error('Error fetching history data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const filteredTransactions = transactions.filter(tx => 
    tx.no.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tx.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomerOrders = customerOrders.filter(co =>
    co.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    co.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    co.customer_email.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleViewDetailMeja = async (order: any) => {
    try {
      const { data: itemsData, error } = await supabase
        .from('customer_order_items')
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          price,
          subtotal,
          products ( name )
        `)
        .eq('order_id', order.id);

      if (error) throw error;

      const mappedItems = (itemsData || []).map(item => ({
        id: item.id,
        transactionId: item.order_id,
        productId: item.product_id,
        productName: (item as any).products?.name || 'Unknown Product',
        price: item.price,
        qty: item.quantity,
        discount: 0,
        subtotal: item.subtotal
      }));

      const mappedTx = {
        id: order.id,
        no: order.id,
        date: order.created_at,
        customerId: null,
        subtotal: order.total_amount,
        discount: 0,
        tax: 0,
        total: order.total_amount,
        paymentMethod: order.payment_method === 'qris' ? 'QRIS' : 'Transfer Bank',
        amountPaid: order.total_amount,
        change: 0,
        note: order.notes,
        status: 'completed',
        userId: order.verified_by,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      } as any;

      setSelectedTx({ tx: mappedTx, items: mappedItems });
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch table order items:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Riwayat Transaksi</h1>
          <p className="text-slate-500 text-sm">Lihat dan cetak ulang struk transaksi sebelumnya.</p>
        </div>
        
        <div className="relative w-72">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={activeTab === 'pos' ? "Cari No. Transaksi..." : "Cari ID Pesanan / Customer..."} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Tabs Submenu */}
      <div className="flex gap-2 border-b border-slate-200 pb-0.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => { setActiveTab('pos'); setSearchQuery(''); }}
          className={`px-4 py-2.5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'pos' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          POS Kasir
        </button>
        <button
          onClick={() => { setActiveTab('meja'); setSearchQuery(''); }}
          className={`px-4 py-2.5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'meja' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Transaksi Meja
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              {activeTab === 'pos' ? (
                <tr>
                  <th className="px-6 py-4">No. Transaksi</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Metode Bayar</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4">No. Pesanan</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Lokasi / Meja</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Metode Bayar</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={activeTab === 'pos' ? 6 : 7} className="px-6 py-12 text-center text-slate-500">
                    <p>Memuat data...</p>
                  </td>
                </tr>
              ) : activeTab === 'pos' ? (
                filteredTransactions.length === 0 ? (
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
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium text-xs cursor-pointer"
                        >
                          <Eye size={14} className="mr-1.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredCustomerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <FileText size={32} className="mx-auto mb-3 opacity-20" />
                      <p>Tidak ada riwayat transaksi meja ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomerOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 uppercase text-xs tracking-wider select-all">{order.id}</td>
                      <td className="px-6 py-4 text-slate-600">{format(order.created_at, 'dd MMM yyyy, HH:mm')}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{order.customer_name}</p>
                          <p className="text-[10px] text-slate-400">{order.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                          order.table_id ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {order.table_id ? tables.find(t => t.id === order.table_id)?.name || order.table_id : 'Takeaway'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-blue-600">Rp {order.total_amount.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-slate-600 uppercase text-xs font-bold">{order.payment_method === 'qris' ? 'QRIS' : 'Transfer'}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleViewDetailMeja(order)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium text-xs cursor-pointer"
                        >
                          <Eye size={14} className="mr-1.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )
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

