import { Transaction, TransactionItem } from '@/lib/db';
import { format } from 'date-fns';
import { useSettingsStore } from '@/stores/settingsStore';

interface ReceiptProps {
  transaction: Transaction;
  items: TransactionItem[];
}

export function Receipt({ transaction, items }: ReceiptProps) {
  const { settings } = useSettingsStore();

  return (
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
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>Total:</span>
          <span>{transaction.total.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Tunai:</span>
          <span>{transaction.amountPaid.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between">
          <span>Kembali:</span>
          <span>{transaction.change.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black mb-2"></div>

      {/* Footer */}
      <div className="text-center mt-4">
        <p>Terima Kasih</p>
        <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
      </div>
    </div>
  );
}
