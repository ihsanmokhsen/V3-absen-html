-- Secure baseline schema for BPAD attendance app.
-- This version is safe to keep in a public repository because it does NOT grant anon access.
-- After running this file, frontend sync will only work after you implement Supabase Auth and
-- issue authenticated sessions from the app.

create table if not exists public.absen_attendance_records (
  date date not null,
  scope text not null,
  admin text not null default '',
  attendance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, scope)
);

create table if not exists public.absen_daily_reports (
  date date not null,
  scope text not null,
  admin text not null default '',
  summary jsonb not null default '{}'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, scope)
);

alter table public.absen_attendance_records enable row level security;
alter table public.absen_daily_reports enable row level security;

-- Cleanup old permissive policies if they exist.
drop policy if exists absen_attendance_records_anon_all on public.absen_attendance_records;
drop policy if exists absen_attendance_records_authenticated_all on public.absen_attendance_records;
drop policy if exists absen_attendance_records_select_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_insert_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_update_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_delete_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_anon_all on public.absen_attendance_records;
drop policy if exists attendance_records_authenticated_all on public.absen_attendance_records;
drop policy if exists attendance_records_select_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_insert_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_update_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_delete_authenticated on public.absen_attendance_records;

drop policy if exists absen_daily_reports_anon_all on public.absen_daily_reports;
drop policy if exists absen_daily_reports_authenticated_all on public.absen_daily_reports;
drop policy if exists absen_daily_reports_select_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_insert_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_update_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_delete_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_anon_all on public.absen_daily_reports;
drop policy if exists daily_reports_authenticated_all on public.absen_daily_reports;
drop policy if exists daily_reports_select_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_insert_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_update_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_delete_authenticated on public.absen_daily_reports;

-- Deny all anon/table privileges.
revoke all on public.absen_attendance_records from anon;
revoke all on public.absen_daily_reports from anon;

-- Grant only authenticated role, with explicit RLS policies.
grant select, insert, update, delete on public.absen_attendance_records to authenticated;
grant select, insert, update, delete on public.absen_daily_reports to authenticated;

create policy absen_attendance_records_select_authenticated
on public.absen_attendance_records
for select
to authenticated
using (true);

create policy absen_attendance_records_insert_authenticated
on public.absen_attendance_records
for insert
to authenticated
with check (true);

create policy absen_attendance_records_update_authenticated
on public.absen_attendance_records
for update
to authenticated
using (true)
with check (true);

create policy absen_attendance_records_delete_authenticated
on public.absen_attendance_records
for delete
to authenticated
using (true);

create policy absen_daily_reports_select_authenticated
on public.absen_daily_reports
for select
to authenticated
using (true);

create policy absen_daily_reports_insert_authenticated
on public.absen_daily_reports
for insert
to authenticated
with check (true);

create policy absen_daily_reports_update_authenticated
on public.absen_daily_reports
for update
to authenticated
using (true)
with check (true);

create policy absen_daily_reports_delete_authenticated
on public.absen_daily_reports
for delete
to authenticated
using (true);
