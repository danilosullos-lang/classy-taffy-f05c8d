import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns the browser Supabase client.
 * Only the publishable/anon key belongs in VITE_* variables.
 * Service-role keys must stay on a trusted server and must never ship to browsers.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado. Copie .env.example para .env.local e informe a URL e a chave pública do projeto."
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  return client;
}
