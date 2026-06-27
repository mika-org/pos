"use client";

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { CustomerOrder, DiningTable, AppUser } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/stores/languageStore';
import { 
  Search, Eye, Check, X, Clipboard, ArrowRight, Download, 
  ChevronLeft, ChevronRight, FileText, CheckCircle, Clock, Info, ShieldAlert,
  Banknote
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { DateRangeFilter, DatePreset } from '@/components/ui/DateRangeFilter';
import { startOfDay, endOfDay, format, subDays } from 'date-fns';

function AdminOrdersPageContent() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const searchParams = useSearchParams();
  
  // Date filter State
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [preset, setPreset] = useState<DatePreset>('last30Days');

  // Db State
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending_confirmation' | 'preparing' | 'delivery' | 'finished' | 'rejected'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  
  // Rejection input state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('customer_orders').select('*');
      
      if (startDate && endDate) {
        const startTs = startOfDay(new Date(startDate)).getTime();
        const endTs = endOfDay(new Date(endDate)).getTime();
        query = query.gte('created_at', startTs).lte('created_at', endTs);
      }

      const [tablesRes, usersRes, ordersRes] = await Promise.all([
        supabase.from('tables').select('*'),
        supabase.from('users').select('id, name'),
        query.order('created_at', { ascending: false })
      ]);

      if (ordersRes.error) throw ordersRes.error;
      
      setTables(tablesRes.data || []);
      setUsers(usersRes.data || []);
      setOrders(ordersRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Listen to search params changes and auto-open specific orders
  useEffect(() => {
    if (orders.length === 0) return;
    const statusParam = searchParams.get('status');
    const idParam = searchParams.get('id');

    if (statusParam) {
      setActiveTab(statusParam as any);
    }
    if (idParam) {
      setSearchQuery(idParam);
      const matched = orders.find(o => o.id === idParam);
      if (matched) {
        handleOpenDetail(matched);
      }
    }
  }, [orders, searchParams]);

  const loadOrderItems = async (orderId: string) => {
    try {
      const { data: itemsData } = await supabase
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
        .eq('order_id', orderId);

      const mappedItems = (itemsData || []).map(item => {
        const prodName = (item as any).products?.name || 'Unknown Product';
        return {
          id: item.id,
          order_id: item.order_id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          productName: prodName
        };
      });

      setSelectedOrderItems(mappedItems);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  const handleOpenDetail = async (order: CustomerOrder) => {
    setSelectedOrder(order);
    setIsRejecting(false);
    setRejectReason('');
    await loadOrderItems(order.id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setIsRejecting(false);
    setRejectReason('');

    // Clear URL search params
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/orders');
    }
  };

  // Verification: Approve Payment
  const handleApprove = async (order: CustomerOrder) => {
    if (!currentUser) return;
    try {
      const now = Date.now();
      const updatedStatus = 'preparing';
      
      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: updatedStatus,
          verified_by: currentUser.id,
          verified_at: now,
          updated_at: now
        })
        .eq('id', order.id);

      if (error) throw error;

      console.log(t('simEmailStatusChanged', { email: order.customer_email, id: order.id, status: 'Preparing' }));
      toast.success(t('successApprove'));
      
      // Visual notification simulator popups
      toast(`📧 [Simulasi] Email notifikasi Pembayaran Diterima dikirim ke ${order.customer_email}`, { icon: '✉️', duration: 4000 });

      handleCloseDetail();
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve payment');
    }
  };

  // Verification: Reject Payment
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !currentUser || !rejectReason.trim()) {
      toast.error(t('reasonRequired'));
      return;
    }

    try {
      const now = Date.now();
      const updatedStatus = 'rejected';

      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: updatedStatus,
          verified_by: currentUser.id,
          verified_at: now,
          notes: rejectReason,
          updated_at: now
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      console.log(t('simEmailStatusChanged', { email: selectedOrder.customer_email, id: selectedOrder.id, status: 'Rejected' }));
      toast.success(t('successReject'));
      
      // Visual notification simulator popups
      toast(`📧 [Simulasi] Email penolakan pembayaran dikirim ke ${selectedOrder.customer_email}`, { icon: '✉️', duration: 4000 });

      handleCloseDetail();
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject payment');
    }
  };

  // Workflow: Next status update
  const handleUpdateStatus = async (order: CustomerOrder, nextStatus: 'preparing' | 'delivery' | 'finished') => {
    try {
      const now = Date.now();
      const { error } = await supabase
        .from('customer_orders')
        .update({
          status: nextStatus,
          updated_at: now
        })
        .eq('id', order.id);

      if (error) throw error;

      console.log(t('simEmailStatusChanged', { email: order.customer_email, id: order.id, status: nextStatus }));
      toast.success(t('successUpdateStatus'));
      
      // Visual notification simulator popups
      toast(`📧 [Simulasi] Email notifikasi Progres (${t(nextStatus as any)}) dikirim ke ${order.customer_email}`, { icon: '✉️', duration: 4000 });

      handleCloseDetail();
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error(t('errorUpdateStatus'));
    }
  };

  const handleDownloadProof = (order: CustomerOrder) => {
    try {
      const link = document.createElement('a');
      link.href = order.payment_proof;
      
      let extension = 'png';
      if (order.payment_proof.includes('pdf')) {
        extension = 'pdf';
      } else if (order.payment_proof.includes('jpeg') || order.payment_proof.includes('jpg')) {
        extension = 'jpg';
      }
      
      link.download = `bukti_bayar_${order.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Unduh bukti pembayaran berhasil!');
    } catch (err) {
      toast.error('Gagal mengunduh berkas');
    }
  };

  const getTableName = (id?: string | null) => {
    if (!id) return t('takeaway');
    return tables.find(t => t.id === id)?.name || id;
  };

  const getUserName = (id?: string | null) => {
    if (!id) return '-';
    return users.find(u => u.id === id)?.name || id;
  };

  // Tab count indicators
  const getTabCount = (tab: typeof activeTab) => {
    if (tab === 'all') return orders.length;
    return orders.filter(o => o.status === tab).length;
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesTab = activeTab === 'all' || o.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_confirmation':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-250 animate-pulse">{t('pending_confirmation')}</span>;
      case 'preparing':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">{t('preparing')}</span>;
      case 'delivery':
        return <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full border border-purple-200">{t('delivery')}</span>;
      case 'finished':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-250">{t('finished')}</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200">{t('rejected')}</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full">{status}</span>;
    }
  };

  // Left borders classes mapping depending on status
  const getStatusBorderClass = (status: string) => {
    switch (status) {
      case 'pending_confirmation':
        return 'border-l-4 border-l-yellow-500';
      case 'preparing':
        return 'border-l-4 border-l-blue-500';
      case 'delivery':
        return 'border-l-4 border-l-purple-500';
      case 'finished':
        return 'border-l-4 border-l-emerald-500';
      case 'rejected':
        return 'border-l-4 border-l-rose-500';
      default:
        return '';
    }
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('adminOrdersTitle')}</h1>
          <p className="text-sm text-slate-500">{t('adminOrdersSubtitle')}</p>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xs font-black text-slate-850 tracking-tight uppercase">Filter Tanggal Pesanan</h3>
          <p className="text-[11px] text-slate-400 font-bold mt-0.5">Saring pesanan masuk berdasarkan tanggal transfer/dibuat.</p>
        </div>
        <DateRangeFilter 
          startDate={startDate} 
          endDate={endDate} 
          selectedPreset={preset} 
          onChange={(start, end, pr) => { setStartDate(start); setEndDate(end); setPreset(pr); setCurrentPage(1); }}
          showAllTime={true}
        />
      </div>

      {/* Tabs with visual count badges */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {(['all', 'pending_confirmation', 'preparing', 'delivery', 'finished', 'rejected'] as const).map(tab => {
          const count = getTabCount(tab);
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2.5 border-b-2 font-bold text-sm transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab === 'all' ? t('allStatus') : t(tab as any)}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === tab 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Filter input */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center">
          <div className="relative w-full max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold pl-5">Order ID</th>
                <th className="p-4 font-bold">Customer</th>
                <th className="p-4 font-bold">Lokasi</th>
                <th className="p-4 font-bold">Total Pembayaran</th>
                <th className="p-4 font-bold">Metode</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold w-24 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">{t('loading')}</td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Tidak ada pesanan customer ditemukan.</td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${getStatusBorderClass(order.status)}`}
                  >
                    <td className="p-4 font-extrabold text-slate-900 uppercase text-xs tracking-wider select-all pl-4">{order.id}</td>
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{order.customer_name}</p>
                        <p className="text-xs text-slate-400">{order.customer_email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        order.table_id ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {getTableName(order.table_id)}
                      </span>
                    </td>
                    <td className="p-4 font-black text-slate-800 text-sm">Rp {order.total_amount.toLocaleString('id-ID')}</td>
                    <td className="p-4 uppercase text-xs font-extrabold text-slate-500">
                      {order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'bank_transfer' ? 'Transfer' : 'Bayar Kasir'}
                    </td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4 text-xs text-slate-500 font-semibold">
                      {new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 flex justify-center">
                      <button 
                        onClick={() => handleOpenDetail(order)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                        title={t('viewDetails')}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/40">
            <span className="text-xs text-slate-400 font-bold">
              Halaman {currentPage} dari {totalPages} ({filteredOrders.length} Pesanan)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL SLIDE DRAWER */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white h-screen w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider select-all">{selectedOrder.id}</h2>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-1 flex items-center">
                  <Clock size={12} className="mr-1" />
                  {new Date(selectedOrder.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              <button 
                onClick={handleCloseDetail}
                className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3.5 shadow-sm">
                <div className="flex items-center space-x-2 border-b border-slate-150 pb-2">
                  <Info size={14} className="text-slate-400" />
                  <h3 className="text-xs text-slate-500 font-black uppercase tracking-wider">Detail Customer & Lokasi</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <p className="text-slate-400">Nama Customer</p>
                    <p className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Lokasi / Meja</p>
                    <p className="font-black text-blue-700 text-sm mt-0.5">{getTableName(selectedOrder.table_id)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">Email Customer</p>
                    <p className="font-bold text-slate-700 text-xs mt-0.5 select-all">{selectedOrder.customer_email}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-2">
                <h3 className="text-xs text-slate-500 font-black uppercase tracking-wider pl-1">{t('orderItems')}</h3>
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm bg-white">
                  {selectedOrderItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-white flex justify-between items-center text-sm">
                      <div>
                        <p className="font-extrabold text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <p className="font-bold text-slate-800">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                    </div>
                  ))}
                  <div className="p-4 bg-slate-50/60 flex justify-between items-center font-black text-slate-900 text-base">
                    <span>{t('total')}</span>
                    <span className="text-blue-600">Rp {selectedOrder.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Verification Info */}
              {(selectedOrder.status !== 'pending_confirmation' && selectedOrder.status !== 'rejected') && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-1.5 text-xs font-semibold text-emerald-800">
                  <p className="flex items-center">
                    <span className="mr-1.5">👤</span>
                    <span>{t('verifiedBy')}: <span className="font-black">{getUserName(selectedOrder.verified_by)}</span></span>
                  </p>
                  {selectedOrder.verified_at && (
                    <p className="flex items-center">
                      <span className="mr-1.5">🕒</span>
                      <span>{t('verifiedAt')}: <span className="font-black">{new Date(selectedOrder.verified_at).toLocaleString('id-ID')}</span></span>
                    </p>
                  )}
                </div>
              )}

              {/* Rejection Notes Info */}
              {selectedOrder.status === 'rejected' && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2 text-xs font-semibold text-rose-800">
                  <p className="flex items-center font-bold text-rose-900">
                    <ShieldAlert size={14} className="mr-1.5" />
                    <span>Ditolak oleh {getUserName(selectedOrder.verified_by)}</span>
                  </p>
                  <p className="pl-5 text-rose-700 font-medium">Alasan: {selectedOrder.notes || 'Bukti bayar tidak jelas.'}</p>
                </div>
              )}

              {/* Payment Proof Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <h3 className="text-xs text-slate-500 font-black uppercase tracking-wider">
                    {selectedOrder.payment_method === 'cashier' ? 'Metode Pembayaran' : t('paymentProofPreview')}
                  </h3>
                  {selectedOrder.payment_method !== 'cashier' && (
                    <button 
                      onClick={() => handleDownloadProof(selectedOrder)}
                      className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>{t('downloadProof')}</span>
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex justify-center items-center overflow-hidden min-h-[220px] max-h-[350px]">
                  {selectedOrder.payment_method === 'cashier' ? (
                    <div className="text-center p-6 space-y-3 bg-white border border-slate-100 rounded-2xl shadow-sm w-full max-w-[340px] animate-in fade-in duration-300">
                      <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                        <Banknote size={24} className="text-blue-600" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Bayar Langsung di Kasir</h4>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Pesanan ini menggunakan metode Bayar di Kasir. Silakan terima pembayaran langsung dari pelanggan di kasir sebesar total tagihan, kemudian klik tombol <strong>Terima Pembayaran Kasir</strong> untuk memproses pesanan ke dapur.
                      </p>
                    </div>
                  ) : selectedOrder.payment_proof.startsWith('data:application/pdf;') ? (
                    <div className="text-center p-6 space-y-3 bg-white border border-slate-100 rounded-2xl shadow-sm w-full max-w-[280px]">
                      <FileText className="mx-auto text-rose-500" size={48} />
                      <p className="text-xs font-bold text-slate-700">Berkas Dokumen PDF</p>
                      <button 
                        onClick={() => {
                          const w = window.open();
                          w?.document.write(`<iframe src="${selectedOrder.payment_proof}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        Buka PDF di Tab Baru
                      </button>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={selectedOrder.payment_proof} 
                      alt="Payment Proof" 
                      className="max-w-full max-h-[300px] rounded-xl object-contain border border-slate-100 cursor-pointer shadow-sm hover:scale-[1.02] transition-transform duration-300"
                      onClick={() => {
                        const w = window.open();
                        w?.document.write(`<img src="${selectedOrder.payment_proof}" style="max-width:100%; max-height:100%; object-contain:fit; margin:auto; display:block;"/>`);
                      }}
                      title="Klik untuk memperbesar"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
              
              {/* REJECTION FORM */}
              {isRejecting ? (
                <form onSubmit={handleRejectSubmit} className="space-y-3.5 animate-in slide-in-from-bottom duration-250">
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">{t('rejectionReason')}</label>
                    <textarea
                      required
                      placeholder={t('rejectionReasonPlaceholder')}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      rows={2}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-rose-650 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      {t('rejectPayment')}
                    </button>
                  </div>
                </form>
              ) : (
                /* MAIN FLOW BUTTONS */
                <div className="flex space-x-2">
                  
                  {/* Step 1: Verify */}
                  {selectedOrder.status === 'pending_confirmation' && (
                    <>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="flex-1 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-655 hover:text-rose-600 font-bold py-3 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer text-xs uppercase tracking-wider"
                      >
                        <X size={15} />
                        <span>{selectedOrder.payment_method === 'cashier' ? 'Tolak Pesanan' : 'Tolak Bukti'}</span>
                      </button>
                      <button
                        onClick={() => handleApprove(selectedOrder)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl flex items-center justify-center space-x-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer text-xs uppercase tracking-wider"
                      >
                        <Check size={15} />
                        <span>{selectedOrder.payment_method === 'cashier' ? 'Terima Pembayaran Kasir' : 'Terima Bukti'}</span>
                      </button>
                    </>
                  )}

                  {/* Step 2: Preparing -> Delivery */}
                  {selectedOrder.status === 'preparing' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder, 'delivery')}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center space-x-1.5 shadow-md shadow-purple-500/10 transition-all cursor-pointer text-xs uppercase tracking-wider"
                    >
                      <span>{t('markDelivery')}</span>
                      <ArrowRight size={15} />
                    </button>
                  )}

                  {/* Step 3: Delivery -> Finished */}
                  {selectedOrder.status === 'delivery' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder, 'finished')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/10 transition-all cursor-pointer text-xs uppercase tracking-wider"
                    >
                      <Check size={15} />
                      <span>{t('markFinished')}</span>
                    </button>
                  )}

                  {/* Step 4: Completed/Rejected */}
                  {(selectedOrder.status === 'finished' || selectedOrder.status === 'rejected') && (
                    <button
                      onClick={handleCloseDetail}
                      className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors cursor-pointer text-xs uppercase tracking-wider"
                    >
                      Tutup
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-semibold space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm">Memuat daftar pesanan...</p>
      </div>
    }>
      <AdminOrdersPageContent />
    </Suspense>
  );
}
