import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  Activity,
  ActivityCreateInput,
  AppNotification,
  AppSettings,
  Followup,
  IntegrationEvent,
  Paginated,
  Profile,
  Proposal,
  ProposalCreateInput,
  Role,
} from '@kidoo/shared';
import { api } from '@/lib/api';
import { errorMessage } from '@/components/common';

/** Invalida tudo que depende da operação comercial (listas, dossiê e métricas). */
function useOpsMutation<V, R = unknown>(fn: (v: V) => Promise<R>, success?: string, onDone?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (success) toast.success(success);
      for (const key of ['activities', 'followups', 'proposals', 'leads', 'dashboard', 'clients', 'notifications']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      onDone?.(r);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// Atividades ------------------------------------------------------------------
export interface ActivityFilters {
  view?: 'all' | 'today' | 'next7' | 'overdue';
  status?: 'pending' | 'done' | 'canceled' | 'all';
  owner_id?: string;
  lead_id?: string;
  from?: string;
  to?: string;
  page_size?: number;
}
export const useActivities = (f: ActivityFilters) =>
  useQuery({ queryKey: ['activities', f], queryFn: () => api.get<Paginated<Activity>>('/activities', { page_size: 200, ...f }) });
export const useCreateActivity = (success = 'Atividade registrada') =>
  useOpsMutation((v: ActivityCreateInput) => api.post<Activity>('/activities', v), success);
export const useCompleteActivity = () =>
  useOpsMutation(({ id, outcome }: { id: string; outcome?: string }) => api.post<Activity>(`/activities/${id}/complete`, { outcome }), 'Atividade concluída');
export const useUpdateActivity = () =>
  useOpsMutation(({ id, ...v }: { id: string } & Record<string, unknown>) => api.patch<Activity>(`/activities/${id}`, v), 'Atividade atualizada');

// Follow-ups ------------------------------------------------------------------
export type FollowupRow = Followup & {
  lead: Followup['lead'] & { lead_diagnostics?: { specific_pain: string | null; proposed_solution: string | null; opening_hook: string | null }[] };
};
export const useFollowups = (f: { view?: string; status?: string; owner_id?: string; lead_id?: string }) =>
  useQuery({ queryKey: ['followups', f], queryFn: () => api.get<Paginated<FollowupRow>>('/followups', { page_size: 200, ...f }) });
export const useCreateCadence = () =>
  useOpsMutation((v: { lead_id: string; anchor_at: string }) => api.post<{ created: number }>('/followups/cadence', v), 'Cadência D+1 a D+8 agendada');
export const useCreateFollowup = () =>
  useOpsMutation((v: { lead_id: string; title: string; due_at: string; message?: string }) => api.post('/followups', v), 'Follow-up agendado');
export const useUpdateFollowup = (success = 'Follow-up atualizado') =>
  useOpsMutation(({ id, ...v }: { id: string; title?: string; message?: string | null; due_at?: string; status?: string }) => api.patch(`/followups/${id}`, v), success);
export const useCompleteFollowup = () =>
  useOpsMutation(
    ({ id, ...v }: { id: string; channel: 'whatsapp' | 'call' | 'email'; outcome?: string; next_due_at?: string | null }) =>
      api.post(`/followups/${id}/complete`, v),
    'Contato registrado',
  );

// Propostas -------------------------------------------------------------------
export const useProposals = (f: { status?: string; owner_id?: string; lead_id?: string }) =>
  useQuery({ queryKey: ['proposals', f], queryFn: () => api.get<Paginated<Proposal>>('/proposals', { page_size: 200, ...f }) });
export const useCreateProposal = () => useOpsMutation((v: ProposalCreateInput) => api.post<Proposal>('/proposals', v), 'Proposta registrada');
export const useUpdateProposal = () =>
  useOpsMutation(({ id, ...v }: { id: string } & Partial<ProposalCreateInput>) => api.patch<Proposal>(`/proposals/${id}`, v), 'Proposta atualizada');
export const useUploadProposalDoc = () =>
  useOpsMutation(({ id, file }: { id: string; file: File }) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<Proposal>(`/proposals/${id}/document`, form);
  }, 'Documento anexado');
export const openProposalDoc = async (id: string) => {
  const win = window.open('', '_blank');
  try {
    const { url } = await api.get<{ url: string }>(`/proposals/${id}/document`);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    toast.error(errorMessage(e));
  }
};

// Usuários e configurações ------------------------------------------------------
export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<{ data: Profile[] }>('/users').then((r) => r.data), staleTime: 5 * 60_000 });
export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...v }: { id: string; role?: Role; is_active?: boolean; full_name?: string; title?: string | null }) => api.patch<Profile>(`/users/${id}`, v),
    onSuccess: () => {
      toast.success('Usuário atualizado');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
};
export const useInviteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; full_name: string; role: Role; password: string }) => api.post<Profile>('/users/invite', v),
    onSuccess: () => {
      toast.success('Conta criada');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
};
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<AppSettings>('/settings'), staleTime: 60_000 });
export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Partial<AppSettings>) => api.patch<AppSettings>('/settings', v),
    onSuccess: (s) => {
      toast.success('Configurações salvas');
      qc.setQueryData(['settings'], s);
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
};

// Notificações ------------------------------------------------------------------
export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: AppNotification[] }>('/notifications').then((r) => r.data),
    refetchInterval: 120_000,
  });
export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => api.post(id ? `/notifications/${id}/read` : '/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

// Integrações ------------------------------------------------------------------
export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}
export interface IntegrationStatus {
  antigravity_webhook: { configured: boolean; endpoint: string };
  wa_me_links: { configured: boolean };
  whatsapp_business: { configured: boolean };
  google_calendar: GoogleCalendarStatus;
}
export const useIntegrationStatus = () => useQuery({ queryKey: ['integrations', 'status'], queryFn: () => api.get<IntegrationStatus>('/integrations/status') });
export const useGoogleCalendarStatus = () =>
  useQuery({ queryKey: ['integrations', 'google'], queryFn: () => api.get<GoogleCalendarStatus>('/integrations/google/status') });
export const useStartGoogleCalendarConnect = () =>
  useMutation({
    mutationFn: (returnTo: 'agenda' | 'integracoes') => api.get<{ url: string }>('/integrations/google/connect', { return_to: returnTo }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
export const useDisconnectGoogleCalendar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/integrations/google/disconnect'),
    onSuccess: () => {
      toast.success('Google Calendar desconectado');
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
};
export const useIntegrationEvents = () =>
  useQuery({
    queryKey: ['integrations', 'events'],
    queryFn: () => api.get<{ data: (IntegrationEvent & { dedupe_match: string | null })[] }>('/integrations/events').then((r) => r.data),
  });
