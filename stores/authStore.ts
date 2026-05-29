import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

const supabase = createClient();

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshSession: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ loading: false });
        return { error };
      }
      set({ user: data.user, session: data.session, loading: false });
      return { error: null };
    } catch (e: any) {
      set({ loading: false });
      return { error: e };
    }
  },

  signUp: async (email, password, username) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        },
      });
      if (error) {
        set({ loading: false });
        return { error };
      }
      set({ loading: false });
      return { error: null };
    } catch (e: any) {
      set({ loading: false });
      return { error: e };
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signOut();
      set({ user: null, session: null, loading: false });
      return { error };
    } catch (e: any) {
      set({ user: null, session: null, loading: false });
      return { error: e };
    }
  },

  refreshSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  initialize: () => {
    if (get().initialized) {
      return () => {};
    }

    set({ loading: true });
    
    // Check initial session
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      set({ 
        session, 
        user: session?.user ?? null, 
        initialized: true,
        loading: false 
      });
    }).catch(() => {
      set({ initialized: true, loading: false });
    });

    // Subscribe to auth state events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        set({ 
          session, 
          user: session?.user ?? null, 
          initialized: true,
          loading: false 
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }
}));
