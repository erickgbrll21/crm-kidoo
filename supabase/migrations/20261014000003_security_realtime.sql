-- ---------------------------------------------------------------------------
-- Row Level Security
-- Navegador: somente leitura (Realtime e consultas diretas) filtrada por papel.
-- Escritas passam pela API (service_role), que aplica as mesmas regras.
-- ---------------------------------------------------------------------------
grant usage on schema private to authenticated;

create or replace function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and is_active
$$;

create or replace function private.can_view_lead(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case private.my_role()
    when 'admin' then true
    when 'manager' then true
    when 'closer' then
      p_owner = (select auth.uid())
      or coalesce((select (s.value)::boolean from public.app_settings s where s.key = 'closer_sees_all_leads'), true)
    else false
  end
$$;

revoke execute on function private.my_role() from public, anon;
revoke execute on function private.can_view_lead(uuid) from public, anon;
grant execute on function private.my_role() to authenticated;
grant execute on function private.can_view_lead(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_contacts enable row level security;
alter table public.lead_diagnostics enable row level security;
alter table public.lead_stage_history enable row level security;
alter table public.activities enable row level security;
alter table public.followups enable row level security;
alter table public.proposals enable row level security;
alter table public.clients enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.integration_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using ((select private.my_role()) is not null);

create policy stages_read on public.pipeline_stages for select to authenticated
  using ((select private.my_role()) is not null);

create policy leads_read on public.leads for select to authenticated
  using (private.can_view_lead(owner_id));

create policy lead_contacts_read on public.lead_contacts for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)));

create policy lead_diagnostics_read on public.lead_diagnostics for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)));

create policy lead_history_read on public.lead_stage_history for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)));

create policy activities_read on public.activities for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select private.my_role()) in ('admin', 'manager')
    or (lead_id is not null and exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)))
  );

create policy followups_read on public.followups for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)));

create policy proposals_read on public.proposals for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and private.can_view_lead(l.owner_id)));

create policy clients_read on public.clients for select to authenticated
  using ((select private.my_role()) is not null);

create policy onboarding_read on public.onboarding_tasks for select to authenticated
  using ((select private.my_role()) is not null);

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy integration_events_read on public.integration_events for select to authenticated
  using ((select private.my_role()) in ('admin', 'manager'));

create policy audit_logs_read on public.audit_logs for select to authenticated
  using ((select private.my_role()) = 'admin');

create policy settings_read on public.app_settings for select to authenticated
  using ((select private.my_role()) is not null);

-- Menor privilégio: anon não lê nada; authenticated só lê.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.leads, public.activities, public.followups, public.proposals, public.notifications, public.clients, public.onboarding_tasks;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado; download via URL assinada emitida pela API após checagem de permissão.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposals', 'proposals', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Configurações padrão (espelham DEFAULT_SETTINGS em packages/shared)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('size_ranges', '[{"size":"micro","max":50000},{"size":"small","max":100000},{"size":"medium","max":300000},{"size":"large","max":500000},{"size":"enterprise","max":null}]'),
  ('stagnation', '{"warning_hours":24,"cold_hours":48}'),
  ('cadence', '{"anchor":"call","steps":[{"key":"d1","offset_days":1,"title":"D+1 · Pós-call","goal":"Retomar diagnóstico e próximos passos"},{"key":"d3","offset_days":3,"title":"D+3 · Reforço de valor","goal":"Demonstrar o impacto do problema identificado"},{"key":"d5","offset_days":5,"title":"D+5 · Objeções","goal":"Esclarecer dúvidas e dificuldades"},{"key":"d8","offset_days":8,"title":"D+8 · Decisão de agenda","goal":"Confirmar interesse e possível cronograma"}]}'),
  ('closer_sees_all_leads', 'true'),
  ('proposal_expiry_warning_days', '3')
on conflict (key) do nothing;
