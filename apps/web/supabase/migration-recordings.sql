-- Class session recordings — one per week of a school year.
--
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab
-- → SQL Editor), or from apps/web:
--   node scripts/run-migration.js supabase/migration-recordings.sql
--
-- There is deliberately no row per week up front. The student list left-joins
-- weeks → recordings, so a missing row IS the grayed-out "not posted yet" state.
-- A row with a null/blank video_url is a draft: the admin can save the title and
-- speaker ahead of the upload without exposing anything to students.

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null unique references public.weeks on delete cascade,
  title text not null,
  speaker text,
  video_url text,              -- unlisted YouTube link; null = not published yet
  recorded_on date,            -- the night class was taught, not the homework due date
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recordings enable row level security;

-- Mirrors weeks/homework_items: any authenticated user reads, admins write.
drop policy if exists "recordings: read all" on public.recordings;
create policy "recordings: read all" on public.recordings
  for select using (auth.role() = 'authenticated');

drop policy if exists "recordings: admin write" on public.recordings;
create policy "recordings: admin write" on public.recordings
  for all using (public.current_user_role() = 'admin');
