import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as Record<string, string | undefined>;

function createFromValues(url?: string, key?: string): SupabaseClient | null {
  return url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
}

let supabase: SupabaseClient | null = createFromValues(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY
);

export async function initSupabase(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;
  try {
    const response = await fetch('/api/supabase-config', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as { url?: string; key?: string };
    supabase = createFromValues(data.url, data.key);
    return supabase;
  } catch {
    return null;
  }
}

export { supabase };
