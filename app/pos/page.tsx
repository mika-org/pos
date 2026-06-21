"use client";

import { useState, useEffect, useRef } from 'react';
import { Product, Category, Transaction, TransactionItem } from '@/lib/db';
import { usePOSStore } from '@/stores/posStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { Receipt } from '@/components/pos/Receipt';
import { supabase } from '@/lib/supabase';
import { Search, ShoppingCart, Trash2, Plus, Minus, User, CreditCard, Banknote, Scan, X, QrCode } from 'lucide-react';

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [completedTransaction, setCompletedTransaction] = useState<{tx: Transaction, items: TransactionItem[]} | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Store actions
  const { cart, addToCart, removeFromCart, updateQty, getSubtotal, getTotal, clearCart } = usePOSStore();

  const finalTotal = getTotal() + (getTotal() * (settings.taxPercentage / 100));

  const fetchMasterData = async () => {
    setIsLoading(true);
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('deleted', false);
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('deleted', false);

      if (categoriesError) console.error(categoriesError);
      if (productsError) console.error(productsError);

      setCategories(categoriesData || []);
      setAllProducts(productsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Filter products based on search and category
  const products = allProducts?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = activeCategory ? p.categoryId === activeCategory : true;
    return matchesSearch && matchesCategory;
  }) || [];

  // Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus on search input if user presses slash
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // If they press Enter in the search box, try to find a barcode match
        if (e.key === 'Enter' && searchQuery) {
          const matchedProduct = allProducts?.find(p => p.barcode === searchQuery);
          if (matchedProduct) {
            addToCart(matchedProduct);
            setSearchQuery('');
          }
        }
        return;
      }

      // Barcode scanner simulation (rapid typing followed by Enter)
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = ''; // Reset if typing is too slow (human)
      }
      
      if (e.key === 'Enter' && barcodeBuffer.length > 3) {
        const matchedProduct = allProducts?.find(p => p.barcode === barcodeBuffer);
        if (matchedProduct) {
          addToCart(matchedProduct);
        } else {
          // Play a buzzer sound or show toast for not found
          console.log('Barcode not found:', barcodeBuffer);
        }
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allProducts, addToCart, searchQuery]);

  const handleCheckout = async () => {
    // Calculate final total with tax
    const subtotalWithDiscount = getTotal();
    const taxAmount = subtotalWithDiscount * (settings.taxPercentage / 100);
    const finalTotal = subtotalWithDiscount + taxAmount;
    
    const paid = Number(amountPaid);
    
    if (paid < finalTotal) {
      alert('Uang pembayaran kurang!');
      return;
    }

    try {
      const txId = crypto.randomUUID();
      const txData: Transaction = {
        id: txId,
        no: `TRX-${Date.now()}`,
        date: Date.now(),
        subtotal: getSubtotal(),
        discount: usePOSStore.getState().globalDiscount,
        tax: taxAmount,
        total: finalTotal,
        paymentMethod: paymentMethod,
        amountPaid: paid,
        change: paid - finalTotal,
        status: 'completed',
        userId: user?.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const { error: txError } = await supabase.from('transactions').insert(txData);
      if (txError) throw txError;
      
      const txItems: TransactionItem[] = [];

      // Save items
      for (const item of cart) {
        txItems.push({
          id: crypto.randomUUID(),
          transactionId: txId,
          productId: item.product.id!,
          productName: item.product.name,
          price: item.product.sellPrice,
          qty: item.qty,
          discount: item.discount,
          subtotal: item.subtotal
        });
      }

      const { error: itemsError } = await supabase.from('transaction_items').insert(txItems);
      if (itemsError) throw itemsError;
      
      // Deduct stock
      for (const item of cart) {
        const newStock = item.product.stock - item.qty;
        await supabase.from('products').update({ stock: newStock, updatedAt: Date.now() }).eq('id', item.product.id);
      }

      setIsPaymentModalOpen(false);
      clearCart();
      setAmountPaid('');
      
      // Set transaction for receipt and open success modal
      setCompletedTransaction({ tx: txData, items: txItems });
      setIsSuccessModalOpen(true);

      // Refresh master data to update grid stock
      await fetchMasterData();
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Terjadi kesalahan saat memproses transaksi');
    }
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    
    try {
      const txId = crypto.randomUUID();
      const txData: Transaction = {
        id: txId,
        no: `HLD-${Date.now()}`,
        date: Date.now(),
        subtotal: getSubtotal(),
        discount: usePOSStore.getState().globalDiscount,
        tax: 0,
        total: getTotal(),
        paymentMethod: '-',
        amountPaid: 0,
        change: 0,
        status: 'hold',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const { error: txError } = await supabase.from('transactions').insert(txData);
      if (txError) throw txError;

      const txItems: TransactionItem[] = [];
      for (const item of cart) {
        txItems.push({
          id: crypto.randomUUID(),
          transactionId: txId,
          productId: item.product.id!,
          productName: item.product.name,
          price: item.product.sellPrice,
          qty: item.qty,
          discount: item.discount,
          subtotal: item.subtotal
        });
      }

      const { error: itemsError } = await supabase.from('transaction_items').insert(txItems);
      if (itemsError) throw itemsError;

      clearCart();
      alert('Transaksi berhasil di-hold!');
      await fetchMasterData();
    } catch (error) {
      console.error('Hold bill failed:', error);
      alert('Gagal hold transaksi');
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6">
      {/* Left Panel: Products */}
      <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200">
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10 flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Cari produk atau scan barcode... (Tekan / untuk fokus)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
              />
            </div>
            <button className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
              <Scan size={20} />
            </button>
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex overflow-x-auto pb-2 space-x-2 hide-scrollbar">
            <button 
              onClick={() => setActiveCategory(null)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === null ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua Produk
            </button>
            {categories?.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id!)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`bg-white rounded-xl p-3 border shadow-sm transition-all text-left flex flex-col h-40 ${
                  product.stock <= 0 
                    ? 'border-rose-200 opacity-50 cursor-not-allowed' 
                    : 'border-slate-200 hover:border-blue-400 hover:shadow-md active:scale-95'
                }`}
              >
                <div className="flex-1 w-full bg-slate-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden border border-slate-200">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No Image</span>
                  )}
                </div>
                <div className="w-full">
                  <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">{product.name}</h3>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-blue-600 font-bold text-sm">Rp {product.sellPrice.toLocaleString('id-ID')}</p>
                    <p className={`text-xs font-medium ${product.stock <= 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                      Stok: {product.stock}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {products.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Scan size={48} className="opacity-20" />
              <p>Produk tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-96 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 relative">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <ShoppingCart size={20} className="mr-2 text-blue-600" />
            Pesanan Saat Ini
          </h2>
          <button 
            onClick={clearCart}
            disabled={cart.length === 0}
            className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors disabled:opacity-50"
            title="Kosongkan Keranjang"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Customer Select */}
        <div className="p-3 border-b border-slate-100">
          <button className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <div className="flex items-center">
              <User size={16} className="mr-2 text-slate-400" />
              <span>Pilih Customer (Opsional)</span>
            </div>
            <Plus size={16} className="text-blue-500" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart size={48} className="opacity-20 mb-2" />
              <p className="text-sm">Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{item.product.name}</h4>
                    <p className="text-xs text-slate-500">Rp {item.product.sellPrice.toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id!)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                    <button 
                      onClick={() => updateQty(item.product.id!, item.qty - 1)}
                      className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:bg-slate-100"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.product.id!, item.qty + 1)}
                      disabled={item.qty >= item.product.stock}
                      className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-bold text-slate-800 text-sm">
                    Rp {item.subtotal.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>Rp {getSubtotal().toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Diskon</span>
              <span className="text-emerald-500">- Rp 0</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Pajak ({settings.taxPercentage}%)</span>
              <span>Rp {(getTotal() * (settings.taxPercentage / 100)).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
              <span className="text-slate-800 font-bold">Total</span>
              <span className="text-2xl font-bold text-blue-600">
                Rp {finalTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleHoldBill}
              disabled={cart.length === 0}
              className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-medium hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              Hold Bill
            </button>
            <button 
              onClick={() => {
                setPaymentMethod('Tunai');
                setAmountPaid('');
                setIsPaymentModalOpen(true);
              }}
              disabled={cart.length === 0}
              className="py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Pembayaran</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-slate-500 mb-1">Total Tagihan</p>
                <p className="text-4xl font-bold text-blue-600">Rp {finalTotal.toLocaleString('id-ID')}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <button 
                  type="button"
                  onClick={() => {
                    setPaymentMethod('Tunai');
                    setAmountPaid('');
                  }}
                  className={`py-3 px-4 rounded-xl border-2 font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'Tunai'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Banknote size={24} />
                  <span className="text-xs">Tunai</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPaymentMethod('QRIS');
                    setAmountPaid(finalTotal.toString());
                  }}
                  className={`py-3 px-4 rounded-xl border-2 font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'QRIS'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Scan size={24} />
                  <span className="text-xs">QRIS</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPaymentMethod('Transfer');
                    setAmountPaid(finalTotal.toString());
                  }}
                  className={`py-3 px-4 rounded-xl border-2 font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'Transfer'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <CreditCard size={24} />
                  <span className="text-xs">Transfer</span>
                </button>
              </div>

              {/* QRIS Display Block */}
              {paymentMethod === 'QRIS' && (
                <div className="mb-6 flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {settings.qrisImage ? (
                    <div className="flex flex-col items-center space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <QrCode size={12} className="text-indigo-500" />
                        Pindai Kode QRIS Toko
                      </span>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                        <img 
                          src={settings.qrisImage} 
                          alt="QRIS QR Code" 
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-slate-400">Total Pembayaran</p>
                        <p className="text-base font-bold text-slate-800">Rp {finalTotal.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 px-2 space-y-2 max-w-sm">
                      <div className="mx-auto w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center border border-amber-200">
                        <Scan size={20} className="text-amber-500 animate-pulse" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800">QRIS Belum Diunggah</h3>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Unggah gambar QRIS di menu <strong>Pengaturan</strong> terlebih dahulu agar QR code dapat tampil di sini.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  {paymentMethod === 'Tunai' ? 'Jumlah Uang Diterima' : `Konfirmasi Jumlah Bayar (${paymentMethod})`}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <input 
                    type="number" 
                    autoFocus
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-300 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="0"
                  />
                </div>
                
                {/* Uang Pas / Quick Amounts */}
                {paymentMethod === 'Tunai' && (
                  <div className="flex space-x-2 mt-2">
                    <button 
                      type="button"
                      onClick={() => setAmountPaid(finalTotal.toString())}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                    >
                      Uang Pas
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAmountPaid((finalTotal + 10000).toString())}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                    >
                      +10Rb
                    </button>
                    <button 
                      type="button"
                      onClick={() => setAmountPaid((finalTotal + 50000).toString())}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                    >
                      +50Rb
                    </button>
                  </div>
                )}
              </div>

              {Number(amountPaid) > 0 && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Kembalian</span>
                  <span className={`text-xl font-bold ${Number(amountPaid) >= finalTotal ? 'text-emerald-600' : 'text-rose-500'}`}>
                    Rp {(Number(amountPaid) - finalTotal).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                type="button"
                onClick={handleCheckout}
                disabled={Number(amountPaid) < finalTotal}
                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selesaikan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success / Receipt Modal */}
      {isSuccessModalOpen && completedTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print:shadow-none print:w-full print:max-w-none print:rounded-none">
            {/* Header hidden when printing */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
              <h2 className="text-lg font-bold text-emerald-600">Transaksi Berhasil!</h2>
              <button onClick={() => setIsSuccessModalOpen(false)} className="text-slate-400 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Receipt Area */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] print:max-h-none print:overflow-visible">
              <Receipt transaction={completedTransaction.tx} items={completedTransaction.items} />
            </div>

            {/* Actions hidden when printing */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-2 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 transition-colors"
              >
                Cetak Struk
              </button>
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
