/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados.');
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // storageKey NÃO definido — usa o padrão do Supabase (sb-<ref>-auth-token)
      // para não conflitar com o Zustand persist que usa 'cromia-auth'
    },
  }
);
