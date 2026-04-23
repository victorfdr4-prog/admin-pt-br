import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function extractAccessToken(authorizationHeader?: string) {
  if (!authorizationHeader) return undefined;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token.trim();
}

export function createSupabaseClient(accessToken?: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY são obrigatórios para o BFF.');
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}
