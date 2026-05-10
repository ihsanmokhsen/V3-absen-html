-- DEVELOPMENT ONLY (NOT SAFE FOR PRODUCTION)
-- This policy set allows unauthenticated (anon) CRUD from frontend clients.
-- Use only for temporary testing in private projects.

alter table public.attendance_records enable row level security;
alter table public.daily_reports enable row level security;

drop policy if exists attendance_records_select_authenticated on public.attendance_records;
drop policy if exists attendance_records_insert_authenticated on public.attendance_records;
drop policy if exists attendance_records_update_authenticated on public.attendance_records;
drop policy if exists attendance_records_delete_authenticated on public.attendance_records;

drop policy if exists daily_reports_select_authenticated on public.daily_reports;
drop policy if exists daily_reports_insert_authenticated on public.daily_reports;
drop policy if exists daily_reports_update_authenticated on public.daily_reports;
drop policy if exists daily_reports_delete_authenticated on public.daily_reports;

grant select, insert, update, delete on public.attendance_records to anon, authenticated;
grant select, insert, update, delete on public.daily_reports to anon, authenticated;

create policy attendance_records_anon_all
on public.attendance_records
for all
to anon
using (true)
with check (true);

create policy daily_reports_anon_all
on public.daily_reports
for all
to anon
using (true)
with check (true);
