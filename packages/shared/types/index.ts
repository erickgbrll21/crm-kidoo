export const ROLES = ['admin', 'manager', 'closer'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gestor Comercial',
  closer: 'Closer',
};

export const STAGE_KEYS = ['enriched', 'approach', 'call_scheduled', 'proposal_sent', 'followup', 'won'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const LEAD_STATUSES = ['open', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

export const LEAD_SIZES = ['micro', 'small', 'medium', 'large', 'enterprise'] as const;
export type LeadSize = (typeof LEAD_SIZES)[number];
export const SIZE_LABEL: Record<LeadSize, string> = {
  micro: 'Micro',
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  enterprise: 'Enterprise',
};

export const ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'proposal', 'followup', 'task', 'note'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  meeting: 'Reunião',
  proposal: 'Proposta',
  followup: 'Follow-up',
  task: 'Tarefa',
  note: 'Anotação',
};
/** Tipos que contam como interação comercial real quando concluídos. */
export const INTERACTION_TYPES: ActivityType[] = ['call', 'whatsapp', 'email', 'meeting'];

export const ACTIVITY_STATUSES = ['pending', 'done', 'canceled'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const FOLLOWUP_STATUSES = ['pending', 'done', 'paused', 'canceled'] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const PROPOSAL_STATUSES = ['draft', 'sent', 'negotiating', 'accepted', 'rejected', 'expired'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_LABEL: Record<ProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  negotiating: 'Em negociação',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
};

export const ONBOARDING_STAGES = [
  'contract_confirmed',
  'kickoff_pending',
  'info_collection',
  'implementation',
  'validation',
  'delivery',
  'recurring_operation',
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];
export const ONBOARDING_LABEL: Record<OnboardingStage, string> = {
  contract_confirmed: 'Contrato confirmado',
  kickoff_pending: 'Kickoff pendente',
  info_collection: 'Coleta de informações',
  implementation: 'Implementação',
  validation: 'Validação',
  delivery: 'Entrega',
  recurring_operation: 'Operação recorrente',
};

export const LEAD_SOURCES = ['antigravity', 'make', 'manual', 'referral', 'inbound', 'outbound'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const SOURCE_LABEL: Record<LeadSource, string> = {
  antigravity: 'Antigravity',
  make: 'Make.com',
  manual: 'Manual',
  referral: 'Indicação',
  inbound: 'Inbound',
  outbound: 'Outbound',
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  key: StageKey;
  name: string;
  position: number;
  is_won: boolean;
}

export interface Lead {
  id: string;
  company_name: string;
  cnpj: string | null;
  website: string | null;
  niche: string | null;
  estimated_monthly_revenue: number | null;
  size: LeadSize | null;
  source: LeadSource;
  stage_id: string;
  status: LeadStatus;
  owner_id: string | null;
  priority: Priority;
  estimated_setup: number | null;
  estimated_mrr: number | null;
  closed_setup: number | null;
  closed_mrr: number | null;
  last_interaction_at: string | null;
  lost_reason: string | null;
  lost_at: string | null;
  won_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /* Campos calculados pela view leads_view */
  stage_key?: StageKey;
  owner_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  next_activity_at?: string | null;
  next_activity_title?: string | null;
  overdue_count?: number;
}

export interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

export interface LeadDiagnostic {
  id: string;
  lead_id: string;
  deep_niche: string | null;
  specific_pain: string | null;
  proposed_solution: string | null;
  suggested_setup: number | null;
  suggested_mrr: number | null;
  opening_hook: string | null;
  source: string;
  generated_at: string;
  is_ai_generated: boolean;
  verified_at: string | null;
  verified_by: string | null;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  owner_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: Priority;
  status: ActivityStatus;
  completed_at: string | null;
  outcome: string | null;
  created_at: string;
  lead?: { id: string; company_name: string } | null;
}

export interface Followup {
  id: string;
  lead_id: string;
  owner_id: string;
  step: string;
  title: string;
  message: string | null;
  due_at: string;
  anchor_at: string | null;
  status: FollowupStatus;
  completed_at: string | null;
  created_at: string;
  lead?: Pick<Lead, 'id' | 'company_name' | 'status'> & { contact_name?: string | null; contact_phone?: string | null };
}

export interface Proposal {
  id: string;
  lead_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  services: string[];
  setup_value: number;
  mrr_value: number;
  implementation_days: number | null;
  valid_until: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  decided_at: string | null;
  document_path: string | null;
  document_name: string | null;
  created_at: string;
  lead?: { id: string; company_name: string } | null;
}

export interface Client {
  id: string;
  lead_id: string;
  company_name: string;
  contract_ref: string | null;
  setup_value: number;
  mrr_value: number;
  services: string[];
  start_date: string | null;
  tech_owner_id: string | null;
  onboarding_stage: OnboardingStage;
  status: 'active' | 'paused' | 'churned';
  created_at: string;
}

export interface OnboardingTask {
  id: string;
  client_id: string;
  stage: OnboardingStage;
  title: string;
  owner_id: string | null;
  due_at: string | null;
  status: 'todo' | 'done';
  completed_at: string | null;
  position: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  lead_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface IntegrationEvent {
  id: string;
  source: string;
  event_id: string;
  event_type: string;
  status: 'received' | 'processed' | 'duplicate' | 'failed';
  error: string | null;
  lead_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export type TimelineKind =
  | 'created'
  | 'stage_changed'
  | 'owner_changed'
  | 'won'
  | 'lost'
  | 'reactivated'
  | 'activity'
  | 'followup'
  | 'proposal';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string | null;
  actor_name: string | null;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
