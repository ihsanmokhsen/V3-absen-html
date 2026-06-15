-- VPS PostgreSQL schema for BPAD attendance app.
-- Migrated from Supabase — all RLS / Supabase-specific auth removed.

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

-- Indexes for common query patterns
create index if not exists idx_attendance_records_date on public.absen_attendance_records (date);
create index if not exists idx_attendance_records_scope on public.absen_attendance_records (scope);
create index if not exists idx_daily_reports_date on public.absen_daily_reports (date);
create index if not exists idx_daily_reports_scope on public.absen_daily_reports (scope);

-- Users table for admin authentication (passwords stored server-side, not in frontend)
create table if not exists public.absen_users (
  scope text primary key,
  username text not null,
  password_hash text not null,
  salt text not null,
  updated_at timestamptz not null default now()
);

-- Pegawai (employee) master data
create table if not exists public.absen_pegawai (
  id text primary key,
  nama text not null,
  bidang text not null,
  jenis text not null default 'ASN',
  urutan int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pegawai_bidang on public.absen_pegawai (bidang);
create index if not exists idx_pegawai_active on public.absen_pegawai (is_active) where is_active = true;
