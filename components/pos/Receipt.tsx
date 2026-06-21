"use client";

import { useState } from 'react';
import { Transaction, TransactionItem } from '@/lib/db';
import { format } from 'date-fns';
import { useSettingsStore } from '@/stores/settingsStore';
import { X, ZoomIn } from 'lucide-react';

interface ReceiptProps {
  transaction: Transaction;
  items: TransactionItem[];
}

export function Receipt({ transaction, items }: ReceiptProps) {
  const { settings } = useSettingsStore();
  const [qrisZoomOpen, setQrisZoomOpen] = useState(false);

  const isQris = transaction.paymentMethod?.toLowerCase() === 'qris';

  return (
    <>
      <div id="print-area" className="bg-white text-black p-4 w-full max-w-[58mm] mx-auto text-xs font-mono">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="font-bold text-sm uppercase">{settings.storeName}</h2>
          <p>{settings.storeAddress}</p>
          <p>Telp: {settings.storePhone}</p>
        </div>

        <div className="border-b border-dashed border-black mb-2"></div>

        {/* Transaction Info */}
        <div className="mb-2">
          <div className="flex justify-between">
            <span>No:</span>
            <span>{transaction.no}</span>
          </div>
          <div className="flex justify-between">
            <span>Tgl:</span>
            <span>{format(transaction.date, 'dd/MM/yy HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span>Admin</span>
          </div>
        </div>

        <div className="border-b border-dashed border-black mb-2"></div>

        {/* Items */}
        <div className="mb-2 space-y-2">
          {items.map((item, idx) => (
            <div key={idx}>
              <div className="font-bold">{item.productName}</div>
              <div className="flex justify-between">
                <span>{item.qty} x {item.price.toLocaleString('id-ID')}</span>
                <span>{item.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {item.discount > 0 && (
                <div className="flex justify-between text-xs">
                  <span>Disc:</span>
                  <span>-{item.discount.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-b border-dashed border-black mb-2"></div>

        {/* Totals */}
        <div className="mb-4">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{transaction.subtotal.toLocaleString('id-ID')}</span>
          </div>
          {transaction.discount > 0 && (
            <div className="flex justify-between">
              <span>Diskon:</span>
              <span>-{transaction.discount.toLocaleString('id-ID')}</span>
            </div>
          )}
          {transaction.tax > 0 && (
            <div className="flex justify-between">
              <span>Pajak ({settings.taxPercentage}%):</span>
              <span>{transaction.tax.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm mt-1 border-t border-dashed border-black pt-1">
            <span>TOTAL:</span>
            <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Bayar ({transaction.paymentMethod || 'Tunai'}):</span>
            <span>Rp {transaction.amountPaid.toLocaleString('id-ID')}</span>
          </div>
          {transaction.change > 0 && (
            <div className="flex justify-between">
              <span>Kembali:</span>
              <span>Rp {transaction.change.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* QRIS Thumbnail — click to zoom */}
        {isQris && settings.qrisImage && (
          <>
            <div className="border-b border-dashed border-black mb-2"></div>
            <div className="text-center mb-2 print:block">
              <p className="font-bold mb-1">Scan QRIS untuk pembayaran</p>
              <div className="relative inline-block group cursor-pointer print:cursor-default" onClick={() => setQrisZoomOpen(true)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.qrisImage}
                  alt="QRIS"
                  className="mx-auto w-36 h-36 object-contain rounded transition-opacity group-hover:opacity-80"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <div className="bg-black/50 rounded-full p-1.5">
                    <ZoomIn size={18} className="text-white" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] mt-1 text-gray-500 print:hidden">Klik untuk perbesar</p>
            </div>
          </>
        )}

        <div className="border-b border-dashed border-black mb-2"></div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p>Terima Kasih</p>
          <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
        </div>
      </div>

      {/* QRIS Zoom Modal */}
      {qrisZoomOpen && settings.qrisImage && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden"
          onClick={() => setQrisZoomOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 relative"
            style={{ animation: 'scaleIn 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setQrisZoomOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">Pembayaran QRIS</h3>
              <p className="text-sm text-slate-500 mt-0.5">{transaction.no}</p>
            </div>

            {/* Total badge */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-3 text-center w-full">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">Total Pembayaran</p>
              <p className="text-2xl font-extrabold text-blue-700">
                Rp {transaction.total.toLocaleString('id-ID')}
              </p>
            </div>

            {/* QRIS full size */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.qrisImage}
              alt="QRIS besar"
              className="w-64 h-64 object-contain rounded-lg"
            />

            <p className="text-xs text-slate-400 text-center">
              Scan kode QR di atas untuk menyelesaikan pembayaran
            </p>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.92); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
