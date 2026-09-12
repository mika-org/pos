/**
 * Re-export PostgreSQL Client as `supabase`
 * Ensures all existing component imports work without requiring changes to dozens of files.
 */
import { db, supabase } from './db-client';

export { db, supabase };
export default supabase;
