import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { can, type Permission, type Profile } from '@kidoo/shared';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  can: (p: Permission) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const onUnauthorized = async (e: Event) => {
      if ((e as CustomEvent).detail === 'session_expired') toast.error('Sua sessão expirou. Entre novamente.');
      await supabase.auth.signOut();
    };
    window.addEventListener('kidoo:unauthorized', onUnauthorized);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('kidoo:unauthorized', onUnauthorized);
    };
  }, []);

  const me = useQuery({
    queryKey: ['me', session?.user.id],
    queryFn: () => api.get<Profile>('/users/me'),
    enabled: !!session,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const value: AuthState = {
    session,
    profile: session ? (me.data ?? null) : null,
    loading: !ready || (!!session && me.isLoading),
    can: (p) => can(me.data?.role, p),
    signOut: async () => {
      await supabase.auth.signOut();
      qc.clear();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
