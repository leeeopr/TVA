import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = async () => {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const secureOpts = { ...options, sameSite: 'none' as const, secure: true };
              cookieStore.set(name, value, secureOpts);
            });
          } catch (error) {
            // The `setAll` method can be called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      }
    }
  );
};
