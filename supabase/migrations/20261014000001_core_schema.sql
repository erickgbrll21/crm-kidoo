-- Kidoo Revenue CRM — esquema principal
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'manager', 'closer');
create type public.lead_status as enum ('open', 'won', 'lost');
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.lead_size as enum ('micro', 'small', 'medium', 'large', 'enterprise');
create type public.activity_type as enum ('call', 'whatsapp', 'email', 'meeting', 'proposal', 'followup', 'task', 'note');
create type public.activity_status as enum ('pending', 'done', 'canceled');
create type public.followup_status as enum ('pending', 'done', 'paused', 'canceled');
create type public.proposal_status as enum ('draft', 'sent', 'negotiating', 'accepted', 'rejected', 'expired');
create type public.onboarding_stage as enum (
  'contract_confirmed', 'kickoff_pending', 'info_collection', 'implementation', 'validation', 'delivery', 'recurring_operation'
);

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null unique,
  role public.app_role not null default 'closer',
  title text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- O papel vem de app_metadata (somente o servidor define); user_metadata é editável pelo usuário.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'closer')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Pipeline
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  position smallint not null unique,
  is_won boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.pipeline_stages (key, name, position, is_won) values
  ('enriched', 'Leads Enriquecidos', 1, false),
  ('approach', 'Abordagem C-Level', 2, false),
  ('call_scheduled', 'Call 15 Min Agendada', 3, false),
  ('proposal_sent', 'Proposta Enviada', 4, false),
  ('followup', 'Follow-up Ativo', 5, false),
  ('won', 'Fechado / Ganho', 6, true);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 2 and 200),
  -- Somente dígitos (normalizado pela API) para deduplicação por igualdade.
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{11,14}$'),
  website text,
  niche text,
  estimated_monthly_revenue numeric(14,2) check (estimated_monthly_revenue >= 0),
  size public.lead_size,
  source text not null default 'manual',
  stage_id uuid not null references public.pipeline_stages (id),
  status public.lead_status not null default 'open',
  owner_id uuid references public.profiles (id) on delete set null,
  priority public.lead_priority not null default 'medium',
  estimated_setup numeric(14,2) check (estimated_setup >= 0),
  estimated_mrr numeric(14,2) check (estimated_mrr >= 0),
  closed_setup numeric(14,2) check (closed_setup >= 0),
  closed_mrr numeric(14,2) check (closed_mrr >= 0),
  last_interaction_at timestamptz,
  lost_reason text,
  lost_at timestamptz,
  won_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_won_consistency check (status <> 'won' or (won_at is not null and closed_setup is not null and closed_mrr is not null)),
  constraint leads_lost_consistency check (status <> 'lost' or (lost_at is not null and lost_reason is not null))
);
create index leads_stage_idx on public.leads (stage_id) where archived_at is null;
create index leads_owner_idx on public.leads (owner_id);
create index leads_status_idx on public.leads (status, won_at, lost_at);
create index leads_created_idx on public.leads (created_at desc);
create index leads_cnpj_idx on public.leads (cnpj) where cnpj is not null;
create index leads_company_trgm_idx on public.leads using gin (company_name extensions.gin_trgm_ops);
create index leads_created_by_idx on public.leads (created_by);
create index leads_updated_by_idx on public.leads (updated_by);
create trigger leads_updated_at before update on public.leads
  for each row execute function private.set_updated_at();

create table public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index lead_contacts_lead_idx on public.lead_contacts (lead_id);
create unique index lead_contacts_one_primary on public.lead_contacts (lead_id) where is_primary;
create index lead_contacts_email_idx on public.lead_contacts (lower(email)) where email is not null;
create index lead_contacts_phone_idx on public.lead_contacts (phone) where phone is not null;

create table public.lead_diagnostics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  deep_niche text,
  specific_pain text,
  proposed_solution text,
  suggested_setup numeric(14,2) check (suggested_setup >= 0),
  suggested_mrr numeric(14,2) check (suggested_mrr >= 0),
  opening_hook text,
  source text not null default 'antigravity',
  generated_at timestamptz not null default now(),
  is_ai_generated boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index lead_diagnostics_lead_idx on public.lead_diagnostics (lead_id, generated_at desc);
create index lead_diagnostics_verified_by_idx on public.lead_diagnostics (verified_by);

create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  event text not null check (event in ('created', 'stage_changed', 'owner_changed', 'won', 'lost', 'reactivated')),
  from_stage_id uuid references public.pipeline_stages (id),
  to_stage_id uuid references public.pipeline_stages (id),
  from_owner_id uuid references public.profiles (id) on delete set null,
  to_owner_id uuid references public.profiles (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id, created_at desc);
create index lead_stage_history_created_idx on public.lead_stage_history (created_at);
create index lead_stage_history_to_stage_idx on public.lead_stage_history (to_stage_id);
create index lead_stage_history_from_stage_idx on public.lead_stage_history (from_stage_id);
create index lead_stage_history_actor_idx on public.lead_stage_history (actor_id);
create index lead_stage_history_from_owner_idx on public.lead_stage_history (from_owner_id);
create index lead_stage_history_to_owner_idx on public.lead_stage_history (to_owner_id);

-- Histórico e regras de status ficam no banco para valer em qualquer caminho de escrita.
create or replace function private.track_lead_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_stage_history (lead_id, event, to_stage_id, to_owner_id, actor_id)
    values (new.id, 'created', new.stage_id, new.owner_id, new.created_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.lead_stage_history (lead_id, event, from_stage_id, to_stage_id, actor_id, note)
    values (
      new.id,
      case new.status when 'won' then 'won' when 'lost' then 'lost' else 'reactivated' end,
      old.stage_id, new.stage_id, new.updated_by,
      case when new.status = 'lost' then new.lost_reason end
    );
    if new.status in ('won', 'lost') then
      update public.followups set status = 'paused' where lead_id = new.id and status = 'pending';
    end if;
  elsif new.stage_id is distinct from old.stage_id then
    insert into public.lead_stage_history (lead_id, event, from_stage_id, to_stage_id, actor_id)
    values (new.id, 'stage_changed', old.stage_id, new.stage_id, new.updated_by);
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into public.lead_stage_history (lead_id, event, from_owner_id, to_owner_id, actor_id)
    values (new.id, 'owner_changed', old.owner_id, new.owner_id, new.updated_by);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Operação comercial
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  owner_id uuid not null references public.profiles (id),
  type public.activity_type not null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  due_at timestamptz,
  priority public.lead_priority not null default 'medium',
  status public.activity_status not null default 'pending',
  completed_at timestamptz,
  outcome text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_done_has_date check (status <> 'done' or completed_at is not null)
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_owner_due_idx on public.activities (owner_id, due_at) where status = 'pending';
create index activities_pending_due_idx on public.activities (due_at) where status = 'pending';
create index activities_created_by_idx on public.activities (created_by);
create trigger activities_updated_at before update on public.activities
  for each row execute function private.set_updated_at();

-- Só contatos concluídos (ligação, WhatsApp, e-mail, reunião) contam como interação comercial real.
create or replace function private.touch_lead_interaction() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.lead_id is not null
     and new.status = 'done'
     and new.type in ('call', 'whatsapp', 'email', 'meeting')
     and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    update public.leads
       set last_interaction_at = greatest(coalesce(last_interaction_at, '-infinity'::timestamptz), new.completed_at)
     where id = new.lead_id;
  end if;
  return new;
end $$;
create trigger activities_touch_lead after insert or update of status on public.activities
  for each row execute function private.touch_lead_interaction();

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null references public.profiles (id),
  step text not null default 'custom',
  title text not null,
  message text,
  due_at timestamptz not null,
  anchor_at timestamptz,
  status public.followup_status not null default 'pending',
  completed_at timestamptz,
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint followups_done_has_date check (status <> 'done' or completed_at is not null)
);
create index followups_lead_idx on public.followups (lead_id);
create index followups_pending_due_idx on public.followups (due_at) where status = 'pending';
create index followups_owner_idx on public.followups (owner_id, due_at);
create index followups_activity_idx on public.followups (activity_id);
create trigger followups_updated_at before update on public.followups
  for each row execute function private.set_updated_at();

-- Trigger de leads criado depois de followups porque a função o referencia.
create trigger leads_track_changes after insert or update on public.leads
  for each row execute function private.track_lead_changes();

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null references public.profiles (id),
  title text not null,
  description text,
  services text[] not null default '{}',
  setup_value numeric(14,2) not null check (setup_value >= 0),
  mrr_value numeric(14,2) not null check (mrr_value >= 0),
  implementation_days integer check (implementation_days between 0 and 730),
  valid_until date,
  status public.proposal_status not null default 'draft',
  sent_at timestamptz,
  decided_at timestamptz,
  document_path text,
  document_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_lead_idx on public.proposals (lead_id);
create index proposals_owner_idx on public.proposals (owner_id);
create index proposals_status_valid_idx on public.proposals (status, valid_until);
create trigger proposals_updated_at before update on public.proposals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clientes e onboarding
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete restrict,
  company_name text not null,
  contract_ref text,
  setup_value numeric(14,2) not null check (setup_value >= 0),
  mrr_value numeric(14,2) not null check (mrr_value >= 0),
  services text[] not null default '{}',
  start_date date,
  tech_owner_id uuid references public.profiles (id) on delete set null,
  onboarding_stage public.onboarding_stage not null default 'contract_confirmed',
  status text not null default 'active' check (status in ('active', 'paused', 'churned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_tech_owner_idx on public.clients (tech_owner_id);
create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  stage public.onboarding_stage not null,
  title text not null,
  owner_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index onboarding_tasks_client_idx on public.onboarding_tasks (client_id, position);
create index onboarding_tasks_owner_idx on public.onboarding_tasks (owner_id);

-- ---------------------------------------------------------------------------
-- Plataforma
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  lead_id uuid references public.leads (id) on delete cascade,
  link text,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_lead_idx on public.notifications (lead_id);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'duplicate', 'failed')),
  error text,
  lead_id uuid references public.leads (id) on delete set null,
  dedupe_match text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, event_id)
);
create index integration_events_created_idx on public.integration_events (created_at desc);
create index integration_events_lead_idx on public.integration_events (lead_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index app_settings_updated_by_idx on public.app_settings (updated_by);
