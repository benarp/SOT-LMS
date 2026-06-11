-- Migration: audit log, email send log, unsubscribe support
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)

-- ── Audit log ────────────────────────────────────────────────
-- Records admin actions (impersonation, role changes, deactivation, etc.)
-- Inserts happen via the service-role client (bypasses RLS); admins can read.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create policy "audit_log: admin read" on audit_log
  for select using (current_user_role() = 'admin');

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);

-- ── Email send log ───────────────────────────────────────────
-- One row per weekly-email send; powers the "last sent" indicator
-- and the accidental double-send warning.
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,                -- 'weekly'
  week_id uuid references public.weeks(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table email_log enable row level security;

create policy "email_log: admin read" on email_log
  for select using (current_user_role() = 'admin');

create index if not exists email_log_type_created_idx on email_log (type, created_at desc);

-- ── Unsubscribe support on profiles ──────────────────────────
alter table profiles
  add column if not exists email_opt_out boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsubscribe_token_idx on profiles (unsubscribe_token);
