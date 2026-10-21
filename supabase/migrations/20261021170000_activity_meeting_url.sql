-- Link da reunião na agenda e no card do pipeline.
alter table public.activities
  add column if not exists meeting_url text;

create or replace view public.leads_view with (security_invoker = true) as
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
  coalesce(od.n, 0)::int as overdue_count,
  na.meeting_url as next_activity_url
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
  select x.due_at, x.title, x.meeting_url from (
    select a.due_at, a.title, a.meeting_url from public.activities a
     where a.lead_id = l.id and a.status = 'pending' and a.due_at >= now()
    union all
    select f.due_at, f.title, null::text from public.followups f
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
