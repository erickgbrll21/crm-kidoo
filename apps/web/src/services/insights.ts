import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Client, OnboardingStage, OnboardingTask, StageKey } from '@kidoo/shared';
import { api } from '@/lib/api';
import { errorMessage } from '@/components/common';

export interface Period {
  from: string;
  to: string;
  owner_id?: string;
}

export interface Summary {
  period: { from: string; to: string };
  active_leads: number;
  pipeline_setup: number;
  pipeline_mrr: number;
  won_count: number;
  lost_count: number;
  closed_setup: number;
  closed_mrr: number;
  conversion: { rate: number | null; won: number; decided: number };
  avg_ticket_setup: number | null;
  avg_ticket_mrr: number | null;
  stagnant_leads: number;
  overdue_followups: number;
}
export interface FunnelRow { key: StageKey; name: string; count: number; setup: number; mrr: number }
export interface RevenueRow { month: string; won: number; setup: number; mrr: number }
export interface CloserRow { owner_id: string; name: string; open: number; won: number; lost: number; conversion: number | null; closed_setup: number; closed_mrr: number }
export interface BreakdownRow { key: string; leads: number; won: number; conversion: number | null }

const get = <T>(path: string, p: Period) => api.get<{ data: T }>(path, { ...p }).then((r) => r.data);

export const useDashboard = (p: Period) => ({
  summary: useQuery({ queryKey: ['dashboard', 'summary', p], queryFn: () => get<Summary>('/dashboard/summary', p) }),
  funnel: useQuery({ queryKey: ['dashboard', 'funnel', p], queryFn: () => get<FunnelRow[]>('/dashboard/funnel', p) }),
  revenue: useQuery({ queryKey: ['dashboard', 'revenue', p], queryFn: () => get<RevenueRow[]>('/dashboard/revenue', p) }),
  closers: useQuery({ queryKey: ['dashboard', 'closers', p], queryFn: () => get<CloserRow[]>('/dashboard/closers', p) }),
  breakdown: useQuery({
    queryKey: ['dashboard', 'breakdown', p],
    queryFn: () => get<{ by_source: BreakdownRow[]; by_niche: BreakdownRow[] }>('/dashboard/breakdown', p),
  }),
});

export interface Report {
  period: { from: string; to: string };
  stage_conversion: { key: StageKey; name: string; reached: number; to_next: number | null }[];
  closers: CloserRow[];
  avg_days_to_close: number | null;
  loss_reasons: { reason: string; count: number }[];
  by_source: BreakdownRow[];
  by_niche: BreakdownRow[];
  closed_setup: number;
  closed_mrr: number;
  proposals: { status: string; count: number }[];
  activities: { type: string; count: number }[];
}
export const useReport = (p: Period) => useQuery({ queryKey: ['dashboard', 'report', p], queryFn: () => get<Report>('/reports', p) });

export type ClientRow = Client & {
  tech_owner: { id: string; full_name: string } | null;
  onboarding_tasks: OnboardingTask[];
};
export const useClients = () =>
  useQuery({ queryKey: ['clients'], queryFn: () => api.get<{ data: ClientRow[] }>('/clients').then((r) => r.data) });

function useClientMutation<V>(fn: (v: V) => Promise<unknown>, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(success);
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export const useUpdateClient = () =>
  useClientMutation(({ id, ...v }: { id: string; onboarding_stage?: OnboardingStage; status?: string; tech_owner_id?: string | null }) => api.patch(`/clients/${id}`, v), 'Onboarding atualizado');
export const useToggleTask = () =>
  useClientMutation(({ id, done }: { id: string; done: boolean }) => api.patch(`/onboarding-tasks/${id}`, { status: done ? 'done' : 'todo' }), 'Tarefa atualizada');
export const useAddTask = () =>
  useClientMutation(({ clientId, ...v }: { clientId: string; stage: OnboardingStage; title: string; owner_id?: string | null }) => api.post(`/clients/${clientId}/tasks`, v), 'Tarefa adicionada');
