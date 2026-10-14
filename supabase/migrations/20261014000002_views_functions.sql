-- View usada pelo Kanban, listas e métricas: contato principal e próxima atividade futura.
create view public.leads_view with (security_invoker = true) as
select
  l.*,
  s.key as stage_key,
  p.full_name as owner_name,
  c.name as contact_name,
  c.role as contact_role,
  c.phone as contact_phone,
  c.email as contact_email,
  na.due_at as next_activity_at,
  na.title as next_activity_title,
  coalesce(od.n, 0)::int as overdue_count
from public.leads l
join public.pipeline_stages s on s.id = l.stage_id
left join public.profiles p on p.id = l.owner_id
left join lateral (
  select lc.name, lc.role, lc.phone, lc.email
  from public.lead_contacts lc
  where lc.lead_id = l.id
  order by lc.is_primary desc, lc.created_at
  limit 1
) c on true
left join lateral (
  select x.due_at, x.title from (
    select a.due_at, a.title from public.activities a
     where a.lead_id = l.id and a.status = 'pending' and a.due_at >= now()
    union all
    select f.due_at, f.title from public.followups f
     where f.lead_id = l.id and f.status = 'pending' and f.due_at >= now()
  ) x
  order by x.due_at
  limit 1
) na on true
left join lateral (
  select count(*) as n from (
    select 1 from public.activities a where a.lead_id = l.id and a.status = 'pending' and a.due_at < now()
    union all
    select 1 from public.followups f where f.lead_id = l.id and f.status = 'pending' and f.due_at < now()
  ) y
) od on true;

-- ---------------------------------------------------------------------------
-- Operações transacionais (chamadas somente pela API com service_role)
-- ---------------------------------------------------------------------------

-- Cria ou atualiza lead + contato principal em uma transação.
create or replace function public.save_lead(p_actor uuid, p_lead_id uuid, p_lead jsonb, p_contact jsonb default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid := p_lead_id;
  r public.leads;
  c public.lead_contacts;
begin
  if v_id is null then
    insert into public.leads (
      company_name, cnpj, website, niche, estimated_monthly_revenue, size, source, stage_id,
      owner_id, priority, estimated_setup, estimated_mrr, created_by, updated_by
    ) values (
      p_lead ->> 'company_name',
      p_lead ->> 'cnpj',
      p_lead ->> 'website',
      p_lead ->> 'niche',
      (p_lead ->> 'estimated_monthly_revenue')::numeric,
      (p_lead ->> 'size')::public.lead_size,
      coalesce(p_lead ->> 'source', 'manual'),
      (select id from public.pipeline_stages where key = coalesce(p_lead ->> 'stage_key', 'enriched')),
      (p_lead ->> 'owner_id')::uuid,
      coalesce((p_lead ->> 'priority')::public.lead_priority, 'medium'),
      (p_lead ->> 'estimated_setup')::numeric,
      (p_lead ->> 'estimated_mrr')::numeric,
      p_actor,
      p_actor
    ) returning id into v_id;
  else
    select * into r from public.leads where id = v_id for update;
    if not found then
      raise exception 'lead_not_found' using errcode = 'P0002';
    end if;
    r := jsonb_populate_record(r, p_lead);
    update public.leads set
      company_name = r.company_name,
      cnpj = r.cnpj,
      website = r.website,
      niche = r.niche,
      estimated_monthly_revenue = r.estimated_monthly_revenue,
      size = r.size,
      source = r.source,
      priority = r.priority,
      estimated_setup = r.estimated_setup,
      estimated_mrr = r.estimated_mrr,
      archived_at = r.archived_at,
      updated_by = p_actor
    where id = v_id;
  end if;

  if p_contact is not null and p_contact <> '{}'::jsonb then
    select * into c from public.lead_contacts where lead_id = v_id and is_primary;
    if found then
      c := jsonb_populate_record(c, p_contact);
      update public.lead_contacts set name = c.name, role = c.role, phone = c.phone, email = c.email where id = c.id;
    elsif nullif(p_contact ->> 'name', '') is not null then
      insert into public.lead_contacts (lead_id, name, role, phone, email, is_primary)
      values (v_id, p_contact ->> 'name', p_contact ->> 'role', p_contact ->> 'phone', p_contact ->> 'email', true);
    end if;
  end if;

  return v_id;
end $$;

-- Marca como ganho, cria o cliente e a trilha padrão de onboarding.
create or replace function public.close_lead_won(
  p_actor uuid,
  p_lead uuid,
  p_setup numeric,
  p_mrr numeric,
  p_services text[],
  p_contract_ref text,
  p_start_date date,
  p_tech_owner uuid
) returns uuid
language plpgsql set search_path = '' as $$
declare
  l public.leads;
  v_client uuid;
  v_owner uuid;
begin
  select * into l from public.leads where id = p_lead for update;
  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if l.status <> 'open' then
    raise exception 'lead_not_open' using errcode = 'P0001';
  end if;

  update public.leads set
    status = 'won',
    stage_id = (select id from public.pipeline_stages where key = 'won'),
    won_at = now(),
    closed_setup = p_setup,
    closed_mrr = p_mrr,
    updated_by = p_actor
  where id = p_lead;

  v_owner := coalesce(p_tech_owner, l.owner_id);

  insert into public.clients (lead_id, company_name, contract_ref, setup_value, mrr_value, services, start_date, tech_owner_id)
  values (p_lead, l.company_name, p_contract_ref, p_setup, p_mrr, coalesce(p_services, '{}'), p_start_date, v_owner)
  returning id into v_client;

  insert into public.onboarding_tasks (client_id, stage, title, owner_id, position)
  select v_client, t.stage::public.onboarding_stage, t.title, v_owner, t.pos
  from (values
    ('contract_confirmed', 'Confirmar assinatura do contrato', 1),
    ('kickoff_pending', 'Agendar e realizar kickoff', 2),
    ('info_collection', 'Coletar acessos e informações do cliente', 3),
    ('implementation', 'Implementar solução contratada', 4),
    ('validation', 'Validar entrega com o cliente', 5),
    ('delivery', 'Entregar e treinar equipe', 6),
    ('recurring_operation', 'Iniciar operação recorrente', 7)
  ) as t(stage, title, pos);

  return v_client;
end $$;

-- Processa evento já registrado em integration_events (idempotência garantida pela unique (source, event_id)).
create or replace function public.ingest_lead_event(
  p_event uuid,
  p_existing_lead uuid,
  p_lead jsonb,
  p_contact jsonb,
  p_diagnostic jsonb,
  p_match text
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_lead uuid := p_existing_lead;
begin
  if v_lead is null then
    v_lead := public.save_lead(null, null, p_lead || jsonb_build_object('stage_key', 'enriched'), p_contact);
  else
    -- Lead existente: só completa campos vazios, nunca sobrescreve dados do time nem move etapa.
    update public.leads set
      cnpj = coalesce(cnpj, p_lead ->> 'cnpj'),
      website = coalesce(website, p_lead ->> 'website'),
      niche = coalesce(niche, p_lead ->> 'niche'),
      estimated_monthly_revenue = coalesce(estimated_monthly_revenue, (p_lead ->> 'estimated_monthly_revenue')::numeric),
      size = coalesce(size, (p_lead ->> 'size')::public.lead_size),
      estimated_setup = coalesce(estimated_setup, (p_lead ->> 'estimated_setup')::numeric),
      estimated_mrr = coalesce(estimated_mrr, (p_lead ->> 'estimated_mrr')::numeric)
    where id = v_lead;
    if p_contact is not null and not exists (select 1 from public.lead_contacts where lead_id = v_lead) then
      insert into public.lead_contacts (lead_id, name, role, phone, email, is_primary)
      values (v_lead, p_contact ->> 'name', p_contact ->> 'role', p_contact ->> 'phone', p_contact ->> 'email', true);
    end if;
  end if;

  if p_diagnostic is not null then
    insert into public.lead_diagnostics (
      lead_id, deep_niche, specific_pain, proposed_solution, suggested_setup, suggested_mrr, opening_hook, source, generated_at, raw
    ) values (
      v_lead,
      p_diagnostic ->> 'deep_niche',
      p_diagnostic ->> 'specific_pain',
      p_diagnostic ->> 'proposed_solution',
      (p_diagnostic ->> 'suggested_setup')::numeric,
      (p_diagnostic ->> 'suggested_mrr')::numeric,
      p_diagnostic ->> 'opening_hook',
      coalesce(p_diagnostic ->> 'source', 'antigravity'),
      coalesce((p_diagnostic ->> 'generated_at')::timestamptz, now()),
      p_diagnostic
    );
  end if;

  update public.integration_events
     set status = 'processed', lead_id = v_lead, dedupe_match = p_match, processed_at = now(), error = null
   where id = p_event;

  return v_lead;
end $$;

-- Conclui follow-up registrando o contato como atividade (conta como interação real) e agenda o próximo.
create or replace function public.complete_followup(
  p_actor uuid,
  p_followup uuid,
  p_channel public.activity_type,
  p_outcome text,
  p_next_due timestamptz
) returns uuid
language plpgsql set search_path = '' as $$
declare
  f public.followups;
  v_activity uuid;
begin
  select * into f from public.followups where id = p_followup for update;
  if not found then
    raise exception 'followup_not_found' using errcode = 'P0002';
  end if;
  if f.status = 'done' then
    raise exception 'followup_already_done' using errcode = 'P0001';
  end if;

  insert into public.activities (lead_id, owner_id, type, title, description, status, completed_at, outcome, created_by)
  values (f.lead_id, p_actor, p_channel, f.title, f.message, 'done', now(), p_outcome, p_actor)
  returning id into v_activity;

  update public.followups set status = 'done', completed_at = now(), activity_id = v_activity where id = p_followup;

  if p_next_due is not null then
    insert into public.followups (lead_id, owner_id, step, title, due_at)
    values (f.lead_id, f.owner_id, 'custom', 'Próximo follow-up', p_next_due);
  end if;

  return v_activity;
end $$;

revoke execute on function public.save_lead(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.close_lead_won(uuid, uuid, numeric, numeric, text[], text, date, uuid) from public, anon, authenticated;
revoke execute on function public.ingest_lead_event(uuid, uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.complete_followup(uuid, uuid, public.activity_type, text, timestamptz) from public, anon, authenticated;
grant execute on function public.save_lead(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.close_lead_won(uuid, uuid, numeric, numeric, text[], text, date, uuid) to service_role;
grant execute on function public.ingest_lead_event(uuid, uuid, jsonb, jsonb, jsonb, text) to service_role;
grant execute on function public.complete_followup(uuid, uuid, public.activity_type, text, timestamptz) to service_role;
