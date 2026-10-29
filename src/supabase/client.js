import { createClient } from '@supabase/supabase-js';

// En desarrollo local (vite dev) se usa DEV si no hay .env. Un build (preview o producción)
// sin las variables falla en vez de apuntar en silencio a DEV.
const DEV_URL = 'https://qsqrnfgcozvznkbdyozs.supabase.co';
const DEV_ANON_KEY = 'sb_publishable_Q4QC6J6XxuLoKSu03sqQLg_O5rOkFqz';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (import.meta.env.DEV ? DEV_URL : undefined);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env.DEV ? DEV_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
