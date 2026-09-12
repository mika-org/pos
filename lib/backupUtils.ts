import { supabase } from './supabase';

const downloadFile = (data: any, filename: string) => {
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
    const data: Record<string, any> = {};
    
    // List all tables we want to backup
    const tables = ['users', 'products', 'categories', 'customers', 'suppliers', 'transactions', 'transaction_items', 'settings', 'tables', 'customer_orders'];
    
    for (const tableName of tables) {
      const { data: tableData, error } = await supabase.from(tableName).select('*');
      if (error) {
        throw new Error(`Error fetching ${tableName}: ${error.message}`);
      }
      data[tableName] = tableData || [];
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(data, `postgres_pos_backup_${timestamp}.json`);
    
    return { success: true };
  } catch (error: any) {
    console.error("PostgreSQL backup failed:", error);
    return { success: false, error: error.message };
  }
};

// Backward-compatible alias
export const exportSupabaseDb = exportPostgresDb;
