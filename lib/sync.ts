import { db } from './db';
import { supabase } from './supabase';
import toast from 'react-hot-toast';
import { cleanDuplicates } from './cleanup';

// Sync Engine for Offline-First Data
export const syncData = async (silent = false) => {
  if (!navigator.onLine) {
    if (!silent) toast.error('Koneksi terputus. Batal menyinkronkan data.');
    return;
  }

  const toastId = silent ? undefined : toast.loading('Menyinkronkan data dengan server...');

  try {
    // 0. CLEANUP LOGIC (Resolve duplicates locally before sync)
    await cleanDuplicates();

    // 1. PUSH LOGIC (Local -> Supabase)
    await pushData();

    // 2. PULL LOGIC (Supabase -> Local)
    await pullData();

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
    { localName: 'users', supabaseName: 'users' },
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
          const stringifiedItems = items.map(item => ({
            ...item,
            id: item.id?.toString()
          }));
          const { error: itemsError } = await supabase.from('transaction_items').upsert(stringifiedItems);
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
  const tablesToPull = [
    { localName: 'categories', supabaseName: 'categories' },
    { localName: 'products', supabaseName: 'products' },
    { localName: 'customers', supabaseName: 'customers' },
    { localName: 'suppliers', supabaseName: 'suppliers' },
    { localName: 'users', supabaseName: 'users' },
    { localName: 'transactions', supabaseName: 'transactions' },
  ];

  for (const tableDef of tablesToPull) {
    const lastSyncKey = `last_pull_${tableDef.localName}`;
    const lastSync = localStorage.getItem(lastSyncKey) || '0';
    const table = (db as any)[tableDef.localName];

    // Query Supabase for records updated after the last pull sync time
    const { data, error } = await supabase
      .from(tableDef.supabaseName)
      .select('*')
      .gt('updatedAt', Number(lastSync));

    if (error) {
      console.error(`Failed pulling ${tableDef.supabaseName}:`, JSON.stringify(error, null, 2));
      continue;
    }

    if (data && data.length > 0) {
      console.log(`Pulled ${data.length} records from ${tableDef.supabaseName}`);
      for (const item of data) {
        // Save/update locally and mark as synced
        await table.put({ ...item, synced: true });

        // If we pulled transactions, also pull their corresponding items
        if (tableDef.localName === 'transactions') {
          const { data: itemsData, error: itemsError } = await supabase
            .from('transaction_items')
            .select('*')
            .eq('transactionId', item.id);

          if (itemsData && !itemsError) {
            for (const txItem of itemsData) {
              await db.transactionItems.put(txItem);
            }
          }
        }
      }
      // Update last sync timestamp
      const maxUpdatedAt = Math.max(...data.map(item => Number(item.updatedAt || 0)));
      if (maxUpdatedAt > 0) {
        localStorage.setItem(lastSyncKey, maxUpdatedAt.toString());
      }
    }
  }
};
