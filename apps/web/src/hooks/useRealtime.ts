import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseConfigured } from '@/lib/supabase';

const TABLES: Record<string, string[]> = {
  leads: ['leads', 'dashboard'],
  activities: ['activities', 'leads', 'dashboard'],
  followups: ['followups', 'leads', 'dashboard'],
  proposals: ['proposals', 'leads'],
  notifications: ['notifications'],
  clients: ['clients'],
  onboarding_tasks: ['clients'],
};

/** Sincroniza a tela entre usuários: qualquer mudança no banco invalida as consultas afetadas. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !supabaseConfigured) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      for (const key of pending) qc.invalidateQueries({ queryKey: [key] });
      pending.clear();
    };
    let channel = supabase.channel('crm-sync');
    for (const [table, keys] of Object.entries(TABLES)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        keys.forEach((k) => pending.add(k));
        clearTimeout(timer);
        timer = setTimeout(flush, 400);
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
