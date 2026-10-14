import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CloseLeadInput,
  Lead,
  LeadContact,
  LeadCreateInput,
  LeadDiagnostic,
  LeadUpdateInput,
  Paginated,
  PipelineStage,
  Proposal,
  StageKey,
  TimelineItem,
  Followup,
  Activity,
} from '@kidoo/shared';
import { api } from '@/lib/api';
import { errorMessage } from '@/components/common';

export interface LeadFilters {
  search?: string;
  owner_id?: string;
  niche?: string;
  priority?: string;
  stage?: string;
  status?: 'open' | 'won' | 'lost' | 'pipeline' | 'all';
  sort?: 'created_at' | 'value' | 'last_interaction';
  page?: number;
  page_size?: number;
  archived?: boolean;
}

export interface LeadDetail {
  lead: Lead;
  contacts: LeadContact[];
  diagnostics: LeadDiagnostic[];
  activities: Activity[];
  followups: Followup[];
  proposals: Proposal[];
  timeline: TimelineItem[];
}

export const leadKeys = {
  all: ['leads'] as const,
  list: (f: LeadFilters) => ['leads', 'list', f] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
};

export const useStages = () =>
  useQuery({
    queryKey: ['stages'],
    queryFn: () => api.get<{ data: PipelineStage[] }>('/stages').then((r) => r.data),
    staleTime: Infinity,
  });

export const useLeads = (filters: LeadFilters) =>
  useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: () => api.get<Paginated<Lead>>('/leads', { ...filters }),
    placeholderData: keepPreviousData,
  });

export const useLead = (id: string | null) =>
  useQuery({
    queryKey: leadKeys.detail(id ?? ''),
    queryFn: () => api.get<LeadDetail>(`/leads/${id}`),
    enabled: !!id,
  });

function useLeadMutation<V, R>(fn: (v: V) => Promise<R>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success);
      qc.invalidateQueries({ queryKey: leadKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export const useCreateLead = () => useLeadMutation((v: LeadCreateInput) => api.post<Lead>('/leads', v), 'Lead cadastrado');
export const useUpdateLead = (id: string) =>
  useLeadMutation((v: LeadUpdateInput) => api.patch<Lead>(`/leads/${id}`, v), 'Alterações salvas');
export const useChangeOwner = (id: string) =>
  useLeadMutation((owner_id: string) => api.patch<Lead>(`/leads/${id}/owner`, { owner_id }), 'Responsável alterado');
export const useCloseLead = (id: string) =>
  useLeadMutation((v: CloseLeadInput) => api.post<{ lead: Lead; client_id: string }>(`/leads/${id}/close`, v), 'Negócio ganho registrado');
export const useLoseLead = (id: string) =>
  useLeadMutation((reason: string) => api.post<Lead>(`/leads/${id}/lose`, { reason }), 'Lead movido para a base de reativação');
export const useReactivateLead = (id: string) =>
  useLeadMutation((stage: StageKey) => api.post<Lead>(`/leads/${id}/reactivate`, { stage }), 'Lead reativado');

/** Move o card na hora e desfaz se a API recusar. */
export function useMoveStage(listKey: QueryKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: StageKey; stageId: string }) => api.patch<Lead>(`/leads/${id}/stage`, { stage }),
    onMutate: async ({ id, stage, stageId }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Paginated<Lead>>(listKey);
      qc.setQueryData<Paginated<Lead>>(listKey, (old) =>
        old && { ...old, data: old.data.map((l) => (l.id === id ? { ...l, stage_key: stage, stage_id: stageId } : l)) },
      );
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      toast.error(errorMessage(e));
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
      qc.invalidateQueries({ queryKey: leadKeys.detail(v.id) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
