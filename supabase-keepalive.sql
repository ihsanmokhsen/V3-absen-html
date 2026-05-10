-- Keepalive table for external scheduler (GitHub Actions, cron service, etc.)
-- Safe for public repo. No anon/authenticated access is granted.

create table if not exists public.system_heartbeat (
  id text primary key,
  source text not null default 'scheduler',
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If row exists, update timestamp automatically by scheduler upsert.

alter table public.system_heartbeat enable row level security;

-- Remove potentially permissive policies.
drop policy if exists system_heartbeat_anon_all on public.system_heartbeat;
drop policy if exists system_heartbeat_authenticated_all on public.system_heartbeat;
drop policy if exists system_heartbeat_select_authenticated on public.system_heartbeat;
drop policy if exists system_heartbeat_insert_authenticated on public.system_heartbeat;
drop policy if exists system_heartbeat_update_authenticated on public.system_heartbeat;

revoke all on public.system_heartbeat from anon;
revoke all on public.system_heartbeat from authenticated;

-- service_role bypasses RLS; explicit grants keep intent clear.
grant select, insert, update on public.system_heartbeat to service_role;
