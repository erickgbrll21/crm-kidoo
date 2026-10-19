-- Tokens OAuth do Google Calendar: só a API (service_role) lê. Sem política = autenticado não vê nada.
alter table public.activities
  add column if not exists google_event_id text;

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  google_email text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger google_calendar_connections_updated_at before update on public.google_calendar_connections
  for each row execute function private.set_updated_at();

alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from anon, authenticated;
