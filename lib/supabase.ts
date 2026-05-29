import { createClient } from './supabase/client';

// Shared single Supabase client for client-side interactions to ensure unified auth session
export const supabase = createClient();

// Helper to check if credentials are provided
export const isSupabaseConfigured = (): boolean => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return !!(supabaseUrl && supabaseAnonKey);
};

