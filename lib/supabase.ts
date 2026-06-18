import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rgccflnozdvdmmxnshqv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable__bPzOh_Pc7OTQDgFEfR22A_uRg4xNqX';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
