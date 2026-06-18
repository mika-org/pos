import { db } from './db';
import { supabase } from './supabase';
import toast from 'react-hot-toast';

// Sync Engine for Offline-First Data
export const syncData = async (silent = false) => {
  if (!navigator.onLine) {
    if (!silent) toast.error('Koneksi terputus. Batal menyinkronkan data.');
    return;
  }

  const toastId = silent ? undefined : toast.loading('Menyinkronkan data dengan server...');

  try {
    // 1. PUSH LOGIC (Local -> Supabase)
    await pushData();

    // 2. PULL LOGIC (Supabase -> Local)
    // await pullData();

    if (!silent) toast.success('Sinkronisasi berhasil!', { id: toastId });
  } catch (error: any) {
    console.error('Sync failed:', error);
    if (!silent) toast.error(`Gagal sinkronisasi: ${error.message || 'Error'}`, { id: toastId });
  }
};

const pushData = async () => {
  // We'll map through our tables and push unsynced records
  // Order matters! Push tables with no dependencies first (e.g. categories)
  const tablesToPush = [
    { localName: 'categories', supabaseName: 'categories' },
    { localName: 'products', supabaseName: 'products' },
    { localName: 'customers', supabaseName: 'customers' },
    { localName: 'suppliers', supabaseName: 'suppliers' },
  ];

  for (const tableDef of tablesToPush) {
    const table = (db as any)[tableDef.localName];
    const unsynced = await table.where('synced').equals('false').toArray(); // Depending on boolean vs string storage in dexie
    const unsyncedTrueBool = await table.filter((item: any) => item.synced === false).toArray();
    
    const recordsToPush = [...unsynced, ...unsyncedTrueBool];

    if (recordsToPush.length > 0) {
      // Clean up records before sending (omit 'synced' column entirely)
      const payload = recordsToPush.map(r => {
        const { synced, ...rest } = r;
        return rest;
      });

      // Push to Supabase
      const { error } = await supabase.from(tableDef.supabaseName).upsert(payload);
      
      if (!error) {
        // Mark as synced locally
        const ids = recordsToPush.map(r => r.id);
        await table.where('id').anyOf(ids).modify({ synced: true });
        console.log(`Pushed ${recordsToPush.length} records to ${tableDef.supabaseName}`);
      } else {
        console.error(`Failed pushing ${tableDef.supabaseName}:`, JSON.stringify(error, null, 2));
        throw new Error(error.message || `Database error on table ${tableDef.supabaseName}`);
      }
    }
  }

  // Handle Transactions & Items
  const unsyncedTx = await db.transactions.filter(tx => tx.synced === false).toArray();
  if (unsyncedTx.length > 0) {
    for (const tx of unsyncedTx) {
      const items = await db.transactionItems.where('transactionId').equals(tx.id!.toString()).toArray();
      
      const { synced, ...payloadTx } = tx;
      const { error: txError } = await supabase.from('transactions').upsert(payloadTx);
      
      if (!txError) {
        if (items.length > 0) {
          const { error: itemsError } = await supabase.from('transaction_items').upsert(items);
          if (itemsError) {
             console.error(`Failed pushing transaction items:`, JSON.stringify(itemsError, null, 2));
             throw new Error(itemsError.message || 'Failed to push transaction items');
          }
        }
        await db.transactions.update(tx.id!, { synced: true });
        console.log(`Pushed transaction ${tx.no}`);
      } else {
        console.error(`Failed pushing transaction:`, JSON.stringify(txError, null, 2));
        throw new Error(txError.message || 'Failed to push transaction');
      }
    }
  }
};

const pullData = async () => {
  // Example pull logic for Products:
  // const lastSync = localStorage.getItem('last_pull_sync') || '0';
  // const { data, error } = await supabase.from('products').select('*').gt('updatedAt', Number(lastSync));
  // if (data && !error) {
  //   for (const product of data) {
  //      await db.products.put({ ...product, synced: true });
  //   }
  //   localStorage.setItem('last_pull_sync', Date.now().toString());
  // }
};
