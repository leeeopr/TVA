import { createClient } from './client';

const supabase = createClient();

export const signInWithEmail = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signUpWithEmail = async (email: string, password: string, username: string) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username || email.split('@')[0],
      },
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    },
  });
};

export const signOutUser = async () => {
  return await supabase.auth.signOut();
};

export const sendPasswordReset = async (email: string) => {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
};

export const updatePassword = async (password: string) => {
  return await supabase.auth.updateUser({ password });
};
