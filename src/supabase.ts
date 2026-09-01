import { createClient } from '@supabase/supabase-js';
const env=import.meta.env as Record<string,string|undefined>;
const url=env.VITE_SUPABASE_URL||env.SUPABASE_URL;
const key=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const configured=Boolean(supabase);
