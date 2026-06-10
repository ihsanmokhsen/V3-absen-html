-- Quick repair for current app tables after rename:
-- public.absen_attendance_records
-- public.absen_daily_reports
--
-- This opens anon/authenticated CRUD access so frontend (anon key) can save/read again.
-- NOT for production hardening.

alter table if exists public.absen_attendance_records enable row level security;
alter table if exists public.absen_daily_reports enable row level security;

grant usage on schema public to anon, authenticated;

drop policy if exists absen_attendance_records_select_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_insert_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_update_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_delete_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_select_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_insert_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_update_authenticated on public.absen_attendance_records;
drop policy if exists attendance_records_delete_authenticated on public.absen_attendance_records;
drop policy if exists absen_attendance_records_anon_all on public.absen_attendance_records;
drop policy if exists attendance_records_anon_all on public.absen_attendance_records;

drop policy if exists absen_daily_reports_select_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_insert_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_update_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_delete_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_select_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_insert_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_update_authenticated on public.absen_daily_reports;
drop policy if exists daily_reports_delete_authenticated on public.absen_daily_reports;
drop policy if exists absen_daily_reports_anon_all on public.absen_daily_reports;
drop policy if exists daily_reports_anon_all on public.absen_daily_reports;

grant select, insert, update, delete on public.absen_attendance_records to anon, authenticated;
grant select, insert, update, delete on public.absen_daily_reports to anon, authenticated;

create policy absen_attendance_records_anon_all
on public.absen_attendance_records
for all
to anon
using (true)
with check (true);

create policy absen_daily_reports_anon_all
on public.absen_daily_reports
for all
to anon
using (true)
with check (true);
