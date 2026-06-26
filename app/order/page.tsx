"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product, Category, DiningTable, CustomerOrder } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from '@/stores/languageStore';
import { 
  User, Mail, ArrowRight, ArrowLeft, ShoppingBag, Search, Plus, Minus, Check, 
  Upload, QrCode, FileText, CheckCircle, RefreshCw, Languages, Copy, Compass, Gift,
  Store
} from 'lucide-react';
import toast from 'react-hot-toast';

function CustomerOrderFormContent() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get('table');
  const { t, language, setLanguage } = useTranslation();
  const { settings, fetchSettings } = useSettingsStore();

  // Wizard Steps: 1: Info, 2: Products, 3: Review, 4: Payment, 5: Success
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Db State
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Customer Info Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tableId, setTableId] = useState('');
  const [selectedTableObj, setSelectedTableObj] = useState<DiningTable | null>(null);

  // Products selection state
  const [cart, setCart] = useState<Record<string, { product: Product; qty: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bank_transfer' | 'cashier'>('qris');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [paymentProofName, setPaymentProofName] = useState<string>('');

  // Submitted Order State (for success step tracking)
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<CustomerOrder | null>(null);

  // Tracking Mode State (for returning customers checking their status)
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<CustomerOrder | null>(null);
  const [trackedOrderItems, setTrackedOrderItems] = useState<any[]>([]);

  // Fetch Master Data & Settings on Mount
  useEffect(() => {
    fetchSettings();
    
    const loadMasterData = async () => {
      try {
        const [tablesRes, categoriesRes, productsRes] = await Promise.all([
          supabase.from('tables').select('*').eq('status', 'active'),
          supabase.from('categories').select('*').eq('deleted', false),
          supabase.from('products').select('*').eq('deleted', false).gt('stock', 0)
        ]);

        setTables(tablesRes.data || []);
        setCategories(categoriesRes.data || []);
        setProducts(productsRes.data || []);
      } catch (err) {
        console.error('Failed to load menu data:', err);
      }
    };
    
    loadMasterData();
  }, []);

  // Lock table if query parameter is present
  useEffect(() => {
    if (tableParam && tables.length > 0) {
      const found = tables.find(t => t.id === tableParam);
      if (found) {
        setTableId(found.id);
        setSelectedTableObj(found);
      }
    }
  }, [tableParam, tables]);

  // Auto-select first bank account when settings load
  useEffect(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0 && !selectedBankId) {
      setSelectedBankId(settings.bankAccounts[0].id);
    }
  }, [settings.bankAccounts, selectedBankId]);

  // Sync selected table object on manual select change
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTableId(val);
    if (val === 'takeaway') {
      setSelectedTableObj(null);
    } else {
      const found = tables.find(t => t.id === val);
      setSelectedTableObj(found || null);
    }
  };

  const handleNextToProducts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!customerEmail.trim() || !/\S+@\S+\.\S+/.test(customerEmail)) {
      toast.error(t('emailRequired'));
      return;
    }
    setStep(2);
  };

  const updateCartQty = (product: Product, delta: number) => {
    if (!product.id) return;
    const currentItem = cart[product.id];
    const newQty = (currentItem?.qty || 0) + delta;

    if (newQty <= 0) {
      const newCart = { ...cart };
      delete newCart[product.id];
      setCart(newCart);
    } else {
      if (newQty > product.stock) {
        toast.error(`Stok terbatas! Maksimal ${product.stock} items.`);
        return;
      }
      setCart({
        ...cart,
        [product.id]: {
          product,
          qty: newQty
        }
      });
    }
  };

  const getSubtotal = () => {
    return Object.values(cart).reduce((sum, item) => sum + (item.product.sellPrice * item.qty), 0);
  };

  const getTax = () => {
    return Math.round(getSubtotal() * ((settings.taxPercentage || 0) / 100));
  };

  const getTotal = () => {
    return getSubtotal() + getTax();
  };

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMb = settings.maxFileSize || 5;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(t('fileTooLarge', { size: maxMb }));
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('fileInvalidType'));
      return;
    }

    setPaymentProofName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPaymentProof(event.target.result as string);
        toast.success("Bukti pembayaran berhasil dimuat!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitOrder = async () => {
    if (!paymentProof) {
      toast.error(t('proofRequired'));
      return;
    }

    setLoading(true);
    try {
      const orderId = `ORD-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 105)}`;
      const now = Date.now();

      const orderPayload = {
        id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        total_amount: getTotal(),
        payment_method: paymentMethod === 'cashier' ? 'bank_transfer' : paymentMethod,
        payment_proof: paymentProof,
        status: 'pending_confirmation',
        notes: null,
        table_id: tableId === 'takeaway' || !tableId ? null : tableId,
        created_at: now,
        updated_at: now
      };

      const { error: orderError } = await supabase
        .from('customer_orders')
        .insert(orderPayload);

      if (orderError) throw orderError;

      const itemInsertions = Object.values(cart).map(item => ({
        id: `${orderId}-${item.product.id}`,
        order_id: orderId,
        product_id: item.product.id,
        quantity: item.qty,
        price: item.product.sellPrice,
        subtotal: item.product.sellPrice * item.qty
      }));

      const { error: itemsError } = await supabase
        .from('customer_order_items')
        .insert(itemInsertions);

      if (itemsError) throw itemsError;

      // Print simulations
      console.log(t('simEmailSentCustomer', { email: customerEmail, id: orderId, status: 'Pending Confirmation' }));
      console.log(t('simAdminNotification', { id: orderId, name: customerName, total: getTotal().toLocaleString('id-ID') }));
      
      toast.success(t('orderSuccess'));

      // Show Simulation Banner to make it extremely visual!
      toast(`📧 [Notifikasi] Simulasi email pesanan berhasil dikirim ke ${customerEmail}`, {
        icon: '✉️',
        duration: 5000,
      });

      setSubmittedOrderId(orderId);
      setSubmittedOrder(orderPayload as any);
      setStep(5);
    } catch (err) {
      console.error('Failed to submit order:', err);
      toast.error('Gagal mengirim pesanan. Coba hubungi kasir.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!submittedOrderId || step !== 5) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('customer_orders')
          .select('*')
          .eq('id', submittedOrderId)
          .single();

        if (data && !error) {
          if (submittedOrder && submittedOrder.status !== data.status) {
            console.log(t('simEmailStatusChanged', { email: customerEmail, id: submittedOrderId, status: data.status }));
            toast.success(`Status pesanan diperbarui ke: ${t(data.status as any)}`);
            toast(`📧 [Notifikasi] Simulasi email pembaruan status (${t(data.status as any)}) dikirim ke ${customerEmail}`, {
              icon: '✉️',
              duration: 4000
            });
          }
          setSubmittedOrder(data);
        }
      } catch (err) {
        console.error('Status check polling failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [submittedOrderId, step, submittedOrder]);

  const handleTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingIdInput.trim()) return;

    setLoading(true);
    setTrackedOrder(null);
    setTrackedOrderItems([]);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', trackingIdInput.trim())
        .single();

      if (orderError || !orderData) {
        toast.error("ID Pesanan tidak ditemukan!");
        setLoading(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from('customer_order_items')
        .select(`
          quantity,
          price,
          subtotal,
          product_id,
          products ( name )
        `)
        .eq('order_id', orderData.id);
      
      const mappedItems = (itemsData || []).map(item => {
        const prodName = (item as any).products?.name || 'Unknown Product';
        return {
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          product_id: item.product_id,
          productName: prodName
        };
      });

      setTrackedOrder(orderData);
      setTrackedOrderItems(mappedItems);
      toast.success("Pesanan ditemukan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal melacak pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetOrder = () => {
    setCart({});
    setPaymentProof('');
    setPaymentProofName('');
    setSubmittedOrderId(null);
    setSubmittedOrder(null);
    setStep(1);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_confirmation':
        return <span className="px-3.5 py-1.5 bg-yellow-500 text-white rounded-full font-extrabold text-xs shadow-sm shadow-yellow-500/20 animate-pulse">{t('pending_confirmation')}</span>;
      case 'preparing':
        return <span className="px-3.5 py-1.5 bg-blue-500 text-white rounded-full font-extrabold text-xs shadow-sm shadow-blue-500/20">{t('preparing')}</span>;
      case 'delivery':
        return <span className="px-3.5 py-1.5 bg-purple-500 text-white rounded-full font-extrabold text-xs shadow-sm shadow-purple-500/20">{t('delivery')}</span>;
      case 'finished':
        return <span className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-full font-extrabold text-xs shadow-sm shadow-emerald-500/20">{t('finished')}</span>;
      case 'rejected':
        return <span className="px-3.5 py-1.5 bg-rose-500 text-white rounded-full font-extrabold text-xs shadow-sm shadow-rose-500/20">{t('rejected')}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Top Navbar Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 transition-transform duration-300 hover:rotate-3">
            P
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">RestoFlow</h1>
            <p className="text-[10px] text-slate-400 font-extrabold tracking-wider mt-1 uppercase">{t('orderFormTitle')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {step !== 5 && (
            <button 
              onClick={() => {
                setIsTrackingMode(!isTrackingMode);
                setTrackedOrder(null);
                setTrackingIdInput('');
              }}
              className="text-xs font-black uppercase tracking-wider text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 px-3.5 py-2.5 rounded-xl bg-blue-50/50 hover:bg-blue-600 cursor-pointer transition-all duration-200 select-none shadow-sm"
            >
              {isTrackingMode ? t('newOrder') : "Lacak Pesanan"}
            </button>
          )}
          
          <button 
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-100/80 rounded-xl transition-all text-xs font-extrabold select-none cursor-pointer"
          >
            <Languages size={14} className="text-slate-500" />
            <span className="uppercase text-slate-600">{language}</span>
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 md:py-8">
        
        {/* --- TRACKING MODE VIEW --- */}
        {isTrackingMode ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden p-6 space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Compass size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Lacak Status Pesanan</h2>
              <p className="text-sm text-slate-400 font-medium">Temukan dan ketahui progres pembuatan hidangan Anda</p>
            </div>

            <form onSubmit={handleTrackLookup} className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Contoh: ORD-12345" 
                value={trackingIdInput}
                onChange={(e) => setTrackingIdInput(e.target.value)}
                className="flex-1 px-4 py-3 border border-slate-250 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold uppercase text-slate-800 tracking-wider text-center"
              />
              <button 
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold px-6 py-3 rounded-2xl transition-colors cursor-pointer shadow-md shadow-blue-500/10 text-sm tracking-wide uppercase"
              >
                Cari
              </button>
            </form>

            {trackedOrder && (
              <div className="border-t border-slate-100 pt-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-50/80 p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-200/60 shadow-inner">
                  <div>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Customer</p>
                    <p className="font-black text-slate-800 text-lg leading-tight mt-1">{trackedOrder.customer_name}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{trackedOrder.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">Status saat ini</p>
                    {getStatusBadge(trackedOrder.status)}
                  </div>
                </div>

                {/* Table Marker Tag */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/80 flex items-center space-x-3 text-sm text-blue-900 shadow-sm">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0 font-bold">
                    T
                  </div>
                  <span>
                    Penanda Lokasi: <span className="font-extrabold text-blue-800">{trackedOrder.table_id ? tables.find(t => t.id === trackedOrder.table_id)?.name || trackedOrder.table_id : t('takeaway')}</span>
                  </span>
                </div>

                {/* Status Stepper Tracker */}
                <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/50">
                  <h3 className="font-black text-slate-800 text-sm tracking-tight">Timeline Progres</h3>
                  
                  {trackedOrder.status === 'rejected' ? (
                    <div className="bg-rose-50 border border-rose-200/60 p-4 rounded-2xl text-rose-800 text-sm space-y-2 animate-in zoom-in duration-300">
                      <p className="font-bold">🚫 Pembayaran Ditolak</p>
                      <p className="text-rose-700 font-medium">Alasan: {trackedOrder.notes || 'Bukti bayar tidak valid.'}</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-[35px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                      {/* Step 1 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          ['pending_confirmation', 'preparing', 'delivery', 'finished'].includes(trackedOrder.status)
                            ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800">
                            {trackedOrder.payment_proof === 'CASHIER' && trackedOrder.status === 'pending_confirmation'
                              ? t('pendingPayment')
                              : t('pending_confirmation')}
                          </p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {trackedOrder.payment_proof === 'CASHIER' && trackedOrder.status === 'pending_confirmation'
                              ? t('cashierInstruction')
                              : 'Bukti transfer sedang divalidasi oleh kasir'}
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          ['preparing', 'delivery', 'finished'].includes(trackedOrder.status)
                            ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{t('preparing')}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">Pesanan sedang dibuat oleh chef di dapur</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          ['delivery', 'finished'].includes(trackedOrder.status)
                            ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{t('delivery')}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">Pesanan sedang diantar langsung ke lokasi Anda</p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          trackedOrder.status === 'finished'
                            ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{t('finished')}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">Pesanan selesai. Selamat menikmati hidangan Anda!</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items List Details */}
                <div className="space-y-3">
                  <h3 className="font-black text-slate-800 text-sm tracking-tight">Detail Pesanan</h3>
                  <div className="border border-slate-200/60 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
                    {trackedOrderItems.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white flex justify-between items-center text-sm">
                        <div>
                          <p className="font-bold text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</p>
                        </div>
                        <p className="font-extrabold text-slate-800">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                    <div className="p-4 bg-slate-50/80 flex justify-between items-center font-black text-slate-900 text-base">
                      <span>Total Bayar</span>
                      <span className="text-blue-600">Rp {trackedOrder.total_amount.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          
          /* --- WIZARD FORM MODE --- */
          <div className="bg-white rounded-3xl border border-slate-250/60 shadow-xl overflow-hidden">
            
            {/* Steps linear status bar */}
            {step < 5 && (
              <div className="bg-slate-950/95 px-6 py-4 flex items-center justify-between border-b border-slate-800">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className="flex items-center">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 transition-all duration-300 ${
                      step === s 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : step > s 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-slate-800 text-slate-500 bg-slate-900'
                    }`}>
                      {step > s ? <Check size={13} className="stroke-3" /> : s}
                    </span>
                    {s < 4 && <div className={`w-10 sm:w-16 h-0.5 mx-1 sm:mx-2 rounded ${step > s ? 'bg-emerald-500' : 'bg-slate-900'}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* STEP 1: CUSTOMER INFO */}
            {step === 1 && (
              <form onSubmit={handleNextToProducts} className="p-6 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('stepInfo')}</h2>
                  <p className="text-xs text-slate-400 font-semibold">{t('orderFormSubtitle')}</p>
                </div>

                <div className="space-y-4">
                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide flex items-center">
                      <User size={14} className="text-slate-400 mr-2" />
                      {t('customerName')} <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder={t('customerNamePlaceholder')}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50/50 hover:bg-slate-50 transition-colors duration-200"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide flex items-center">
                      <Mail size={14} className="text-slate-400 mr-2" />
                      {t('customerEmail')} <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input 
                      type="email" 
                      required
                      placeholder={t('customerEmailPlaceholder')}
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50/50 hover:bg-slate-50 transition-colors duration-200"
                    />
                  </div>

                  {/* Table Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">
                      {t('diningTable')}
                    </label>
                    
                    {tableParam && selectedTableObj ? (
                      <div className="bg-linear-to-tr from-blue-50 to-indigo-50 border border-blue-200/80 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in zoom-in duration-300">
                        <div>
                          <p className="text-[10px] text-blue-600 font-black uppercase tracking-wider">{t('lockedTable')}</p>
                          <p className="text-lg font-black text-indigo-950 mt-0.5">{selectedTableObj.name}</p>
                        </div>
                        <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                          <CheckCircle size={20} />
                        </div>
                      </div>
                    ) : (
                      <select
                        value={tableId}
                        onChange={handleTableChange}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 bg-white outline-none hover:bg-slate-50 transition-colors duration-200"
                      >
                        <option value="">-- {t('selectDiningTable')} --</option>
                        <option value="takeaway">{t('takeaway')}</option>
                        {tables.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-md shadow-blue-500/20 flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/30 cursor-pointer"
                >
                  <span className="tracking-wide uppercase text-sm">Pilih Menu</span>
                  <ArrowRight size={16} className="ml-2" />
                </button>
              </form>
            )}

            {/* STEP 2: SELECT PRODUCTS */}
            {step === 2 && (
              <div className="p-6 space-y-5 flex flex-col max-h-[82vh]">
                <div className="space-y-3 shrink-0">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('stepProducts')}</h2>
                    <span className="bg-blue-50 text-blue-700 text-xs font-black px-3 py-1 rounded-full border border-blue-100 shadow-sm">{getCartCount()} Menu</span>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
                    <input 
                      type="text"
                      placeholder={t('searchProducts')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                    />
                  </div>

                  {/* Categories Tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${
                        activeCategory === 'all' 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                          : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      {t('allCategories')}
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id!)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${
                          activeCategory === cat.id 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                            : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/80'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product List Grid */}
                <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[250px] pr-1 scrollbar-thin">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium">Menu tidak ditemukan</div>
                  ) : (
                    filteredProducts.map(p => {
                      const cartItem = cart[p.id!];
                      return (
                        <div key={p.id} className="p-3 bg-white hover:bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between transition-all duration-200 hover:shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-14 h-14 bg-slate-100 rounded-xl border border-slate-200/60 overflow-hidden flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag size={22} className="text-slate-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-800 text-sm leading-tight">{p.name}</p>
                              <p className="text-xs text-blue-600 font-black mt-1">Rp {p.sellPrice.toLocaleString('id-ID')}</p>
                              {p.stock <= 5 ? (
                                <span className="inline-block text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded-md mt-1.5 border border-rose-100">Stok sisa {p.stock}</span>
                              ) : (
                                <p className="text-[9px] text-slate-400 font-bold mt-1">Stok: {p.stock}</p>
                              )}
                            </div>
                          </div>

                          {/* Cart Add/Minus buttons */}
                          {cartItem ? (
                            <div className="flex items-center bg-blue-600 text-white rounded-xl p-1 shadow-sm">
                              <button 
                                onClick={() => updateCartQty(p, -1)}
                                className="p-1 hover:bg-blue-700 rounded-lg cursor-pointer"
                              >
                                <Minus size={13} className="stroke-3" />
                              </button>
                              <span className="px-3.5 font-black text-xs">{cartItem.qty}</span>
                              <button 
                                onClick={() => updateCartQty(p, 1)}
                                className="p-1 hover:bg-blue-700 rounded-lg cursor-pointer"
                              >
                                <Plus size={13} className="stroke-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => updateCartQty(p, 1)}
                              className="bg-white hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-200/80 font-black px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              {t('addToCart')}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Controls */}
                <div className="shrink-0 pt-3 border-t border-slate-100 flex justify-between space-x-3">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <ArrowLeft size={14} className="mr-1.5" />
                    <span>Kembali</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (getCartCount() === 0) {
                        toast.error(t('selectProductError'));
                        return;
                      }
                      setStep(3);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider shadow-md shadow-blue-500/10"
                  >
                    <span>Lanjut</span>
                    <ArrowRight size={14} className="ml-1.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW ITEMS */}
            {step === 3 && (
              <div className="p-6 space-y-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('selectedProducts')}</h2>

                {/* Review Items List */}
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-150 shadow-sm bg-white">
                  {Object.values(cart).map(item => (
                    <div key={item.product.id} className="p-4 bg-white flex justify-between items-center">
                      <div>
                        <p className="font-extrabold text-slate-800 leading-tight">{item.product.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.qty} x Rp {item.product.sellPrice.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <p className="font-black text-slate-900">Rp {(item.qty * item.product.sellPrice).toLocaleString('id-ID')}</p>
                    </div>
                  ))}
                  
                  {/* Calculations */}
                  <div className="p-4 bg-slate-50 space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>{t('subtotal')}</span>
                      <span className="font-semibold">Rp {getSubtotal().toLocaleString('id-ID')}</span>
                    </div>
                    {settings.taxPercentage > 0 && (
                      <div className="flex justify-between">
                        <span>{t('tax')} ({settings.taxPercentage}%)</span>
                        <span className="font-semibold">Rp {getTax().toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 text-lg border-t border-slate-200 pt-3 mt-3">
                      <span>{t('total')}</span>
                      <span className="text-blue-600">Rp {getTotal().toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                {/* Location Marker banner */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs font-semibold text-slate-500 space-y-1.5 shadow-inner">
                  <p>👤 {t('customerName')}: <span className="font-extrabold text-slate-800">{customerName}</span> ({customerEmail})</p>
                  <p>🍽️ {t('diningTable')}: <span className="font-extrabold text-slate-800">{selectedTableObj ? selectedTableObj.name : t('takeaway')}</span></p>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-slate-100 flex justify-between space-x-3">
                  <button 
                    onClick={() => setStep(2)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <ArrowLeft size={14} className="mr-1.5" />
                    <span>Kembali</span>
                  </button>
                  <button 
                    onClick={() => setStep(4)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider shadow-md shadow-blue-500/15"
                  >
                    <span>Metode Bayar</span>
                    <ArrowRight size={14} className="ml-1.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PAYMENT UPLOAD */}
            {step === 4 && (
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('paymentMethod')}</h2>
                  <p className="text-xs text-slate-400 font-semibold">Tentukan pilihan metode pembayaran dan upload bukti transfer</p>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('qris'); setPaymentProof(''); setPaymentProofName(''); }}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                      paymentMethod === 'qris' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-800 font-black shadow-sm' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode size={20} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">QRIS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('bank_transfer'); setPaymentProof(''); setPaymentProofName(''); }}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                      paymentMethod === 'bank_transfer' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-800 font-black shadow-sm' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={20} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setPaymentMethod('cashier'); 
                      setPaymentProof('CASHIER'); 
                      setPaymentProofName('Bayar di Kasir'); 
                    }}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                      paymentMethod === 'cashier' 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-800 font-black shadow-sm' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Store size={20} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Di Kasir</span>
                  </button>
                </div>

                {/* Instructions Container */}
                <div className="p-4 bg-slate-50/60 border border-slate-250/60 rounded-3xl flex flex-col items-center text-center">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Informasi Pembayaran</p>
                  
                  {paymentMethod === 'qris' && (
                    <div className="space-y-4 flex flex-col items-center">
                      <p className="text-xs text-slate-500 font-semibold">{t('qrisDesc')}</p>
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm transition-transform duration-300 hover:scale-[1.03]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={settings.qrisImage || 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=POS_RESTO_QRIS_DUMMY'} 
                          alt="QRIS QR Code" 
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      <div className="bg-blue-50/80 px-4 py-2 border border-blue-100 rounded-xl text-blue-800 font-black text-sm">
                        Total: Rp {getTotal().toLocaleString('id-ID')}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'bank_transfer' && (
                    <div className="space-y-4 w-full">
                      <p className="text-xs text-slate-500 font-semibold">{t('bankTransferDesc')}</p>
                      
                      {!settings.bankAccounts || settings.bankAccounts.length === 0 ? (
                        <p className="text-sm text-rose-600 bg-rose-50 p-4 rounded-2xl text-center border border-dashed border-rose-200">
                          {t('noBankAccounts')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-left block">
                            {t('selectBankAccount')}
                          </label>
                          <div className="grid grid-cols-1 gap-3">
                            {settings.bankAccounts.map((bank) => {
                              const isSelected = selectedBankId === bank.id;
                              return (
                                <div 
                                  key={bank.id}
                                  onClick={() => setSelectedBankId(bank.id)}
                                  className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition-all relative ${
                                    isSelected 
                                      ? 'border-blue-600 bg-blue-50/30' 
                                      : 'border-slate-200 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full uppercase">
                                        {bank.bankName}
                                      </span>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <p className="text-base font-black text-slate-800 tracking-wider select-all">
                                          {bank.accountNumber}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(bank.accountNumber);
                                            toast.success(t('copySuccess'));
                                          }}
                                          className="p-1 hover:bg-slate-250 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                          title="Salin Rekening"
                                        >
                                          <Copy size={14} />
                                        </button>
                                      </div>
                                      <p className="text-xs text-slate-500 font-bold">a.n. {bank.accountHolder}</p>
                                    </div>
                                    {isSelected && (
                                      <div className="bg-blue-600 text-white rounded-full p-1 shadow-sm">
                                        <Check size={12} className="stroke-3" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-blue-50/80 inline-block px-4 py-2 border border-blue-100 rounded-xl text-blue-800 font-black text-sm">
                        Total: Rp {getTotal().toLocaleString('id-ID')}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'cashier' && (
                    <div className="space-y-4 py-2 flex flex-col items-center">
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm">
                        {t('cashierDesc')}
                      </p>
                      <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-center space-x-3 text-left max-w-sm">
                        <span className="text-xl">🏪</span>
                        <div>
                          <p className="text-[10px] text-amber-800 font-black uppercase tracking-wider">Langkah Selanjutnya</p>
                          <p className="text-[11px] text-amber-900 font-bold mt-0.5 leading-snug">{t('cashierInstruction')}</p>
                        </div>
                      </div>
                      <div className="bg-blue-50/80 px-4 py-2 border border-blue-100 rounded-xl text-blue-800 font-black text-sm">
                        Total: Rp {getTotal().toLocaleString('id-ID')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Proof Area */}
                {paymentMethod !== 'cashier' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{t('uploadProof')}</label>
                    
                    <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-white rounded-2xl p-6 transition-all duration-300 text-center shadow-sm">
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg, application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      
                      <div className="space-y-2 flex flex-col items-center">
                        <Upload size={32} className="text-slate-400 animate-bounce" style={{ animationDuration: '2s' }} />
                        {paymentProofName ? (
                          <div className="flex items-center space-x-1.5 text-emerald-600 font-black animate-in zoom-in duration-300">
                            <CheckCircle size={16} />
                            <span className="text-sm truncate max-w-[240px]">{paymentProofName}</span>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-slate-700">{t('dragDrop')}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{t('uploadProofDesc', { size: settings.maxFileSize || 5 })}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="pt-4 border-t border-slate-100 flex justify-between space-x-3">
                  <button 
                    onClick={() => setStep(3)}
                    disabled={loading}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold py-3.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <ArrowLeft size={14} className="mr-1.5" />
                    <span>Kembali</span>
                  </button>
                  <button 
                    onClick={handleSubmitOrder}
                    disabled={loading || !paymentProof}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl shadow-md shadow-emerald-500/15 flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin mr-1.5" />
                        <span>{t('submitting')}</span>
                      </>
                    ) : (
                      <span>{t('submitOrder')}</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: SUCCESS & LIVE TRACKING */}
            {step === 5 && submittedOrder && (
              <div className="p-6 space-y-6 text-center animate-in fade-in duration-500">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle size={32} />
                </div>
                
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('orderSuccess')}</h2>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                    {submittedOrder.payment_proof === 'CASHIER' ? t('orderSuccessDescCashier') : t('orderSuccessDesc')}
                  </p>
                </div>

                {/* Display Order Code Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 max-w-xs mx-auto shadow-inner relative overflow-hidden group">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{t('orderIdLabel')}</p>
                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <p className="text-2xl font-black text-slate-900 tracking-wider uppercase select-all">{submittedOrderId}</p>
                    <button 
                      onClick={() => {
                        if (submittedOrderId) {
                          navigator.clipboard.writeText(submittedOrderId);
                          toast.success("ID disalin!");
                        }
                      }}
                      className="p-1.5 hover:bg-slate-250 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Copy"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold mt-1">{t('pleaseNoteId')}</p>
                </div>

                {/* Table Marker tag banner */}
                <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full text-xs text-indigo-800 font-black mx-auto">
                  <span>🍽️ Meja Pemesan: {selectedTableObj ? selectedTableObj.name : t('takeaway')}</span>
                </div>

                {/* Real-time tracker stepper */}
                <div className="border-t border-slate-100 pt-6 text-left max-w-xs mx-auto space-y-4">
                  <h3 className="font-black text-slate-900 text-sm tracking-tight flex items-center">
                    <RefreshCw size={14} className="animate-spin text-blue-500 mr-2" />
                    <span>Lacak Progres Pesanan</span>
                  </h3>

                  {submittedOrder.status === 'rejected' ? (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-800 text-xs space-y-1.5 animate-in zoom-in duration-300">
                      <p className="font-bold">🚫 Pembayaran Ditolak</p>
                      <p className="text-rose-700 font-medium">Alasan: {submittedOrder.notes || 'Bukti bayar tidak jelas.'}</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-[35px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                      {/* Step 1 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          ['pending_confirmation', 'preparing', 'delivery', 'finished'].includes(submittedOrder.status)
                            ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800 leading-none">
                            {submittedOrder.payment_proof === 'CASHIER' && submittedOrder.status === 'pending_confirmation'
                              ? t('pendingPayment')
                              : t('pending_confirmation')}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {submittedOrder.payment_proof === 'CASHIER' && submittedOrder.status === 'pending_confirmation'
                              ? t('cashierInstruction')
                              : 'Bukti bayar sedang dicek kasir'}
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          ['preparing', 'delivery', 'finished'].includes(submittedOrder.status)
                            ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800 leading-none">{t('preparing')}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Chef sedang meramu pesanan Anda</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          ['delivery', 'finished'].includes(submittedOrder.status)
                            ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800 leading-none">{t('delivery')}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Pesanan dalam perjalanan ke meja</p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="relative flex items-start pl-8">
                        <span className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          submittedOrder.status === 'finished'
                            ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'
                        }`}>
                          <Check size={11} className="stroke-3" />
                        </span>
                        <div>
                          <p className="font-bold text-sm text-slate-800 leading-none">{t('finished')}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Makanan disajikan. Selamat makan!</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email visual simulator banner */}
                <div className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-4 py-3 rounded-2xl max-w-xs mx-auto text-left flex items-start space-x-2 animate-pulse mt-4">
                  <div className="bg-blue-600 text-white p-1 rounded mt-0.5 shrink-0">✉️</div>
                  <div>
                    <p className="font-bold text-slate-100">Simulasi Notifikasi</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">Sistem sedang mengirim data progress pesanan ke email <span className="text-blue-400 underline">{customerEmail}</span>.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 max-w-xs mx-auto">
                  <button 
                    onClick={handleResetOrder}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3.5 rounded-xl transition-colors cursor-pointer text-xs uppercase tracking-wider"
                  >
                    {t('newOrder')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CustomerOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-lg">Memuat formulir...</div>}>
      <CustomerOrderFormContent />
    </Suspense>
  );
}
