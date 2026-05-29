import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, session, loading, signIn, signUp, signOut, initialize } = useAuthStore();

  useEffect(() => {
    const unsub = initialize();
    return () => {
      unsub();
    };
  }, [initialize]);

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut
  };
}
