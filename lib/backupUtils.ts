import { supabase } from './supabase';

const downloadFile = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportPostgresDb = async () => {
  try {
    const data: Record<string, unknown[]> = {};
    
    // List all tables we want to backup
    const tables = ['users', 'products', 'categories', 'customers', 'suppliers', 'transactions', 'transaction_items', 'settings', 'tables', 'customer_orders', 'customer_order_items'];
    
    for (const tableName of tables) {
      const { data: tableData, error } = await supabase.from(tableName).select('*');
      if (error) {
        throw new Error(`Error fetching ${tableName}: ${error.message}`);
      }
      data[tableName] = tableData || [];
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(data, `postgres_backup_${timestamp}.json`);
    
    return { success: true };
  } catch (error: unknown) {
    console.error("PostgreSQL backup failed:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Backup gagal' };
  }
};
