-- Migration: per-student Bible reading plan (Shorter vs Whole Bible)
--
-- Students pick one of two reading plans. bible_reading homework items can be
-- tagged for a specific plan; a null tag means the item is shown to everyone
-- (all non-bible_reading items stay null).
--
-- History: a student's plan for a given week resolves as
--   student_week_plans[week] ?? profiles.bible_plan
-- Rows are written to student_week_plans ONLY when a student changes their
-- setting, freezing past weeks under the plan that was actually in effect then.
-- Nothing is written from merely viewing a page.

-- ── Item tagging ─────────────────────────────────────────────
alter table homework_items add column if not exists bible_plan text
  check (bible_plan in ('shorter', 'whole'));

-- ── Current preference ───────────────────────────────────────
alter table profiles add column if not exists bible_plan text not null default 'shorter'
  check (bible_plan in ('shorter', 'whole'));

-- ── Frozen history for past weeks ────────────────────────────
create table if not exists student_week_plans (
  student_id uuid not null references profiles on delete cascade,
  week_id uuid not null references weeks on delete cascade,
  plan text not null check (plan in ('shorter', 'whole')),
  recorded_at timestamptz not null default now(),
  primary key (student_id, week_id)
);

alter table student_week_plans enable row level security;

-- Mirrors the submissions policies: own rows, admins all, leaders their group.
-- Dropped first so this migration can be re-run safely.
drop policy if exists "student_week_plans: own" on student_week_plans;
drop policy if exists "student_week_plans: admin read" on student_week_plans;
drop policy if exists "student_week_plans: group leader read" on student_week_plans;

create policy "student_week_plans: own" on student_week_plans
  for all using (student_id = auth.uid());
create policy "student_week_plans: admin read" on student_week_plans
  for select using (current_user_role() = 'admin');
create policy "student_week_plans: group leader read" on student_week_plans
  for select using (
    current_user_role() = 'group_leader' and
    student_id in (select id from profiles where group_id = current_user_group_id())
  );

-- ── Self-service plan change ─────────────────────────────────
-- security definer + `where id = auth.uid()`, same as update_own_name /
-- update_own_birthday — a blanket UPDATE policy on profiles would expose
-- role/group_id.
create or replace function public.update_own_bible_plan(new_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_plan text;
begin
  if new_plan not in ('shorter', 'whole') then
    raise exception 'invalid bible plan: %', new_plan;
  end if;

  select bible_plan into old_plan from profiles where id = auth.uid();

  -- Freeze every already-past week of the active year under the OLD plan, so
  -- revisiting old or overdue work still shows what was assigned at the time.
  -- `do nothing` means an earlier freeze always wins.
  if old_plan is not null and old_plan is distinct from new_plan then
    insert into student_week_plans (student_id, week_id, plan)
    select auth.uid(), w.id, old_plan
    from weeks w
    join school_years sy on sy.id = w.school_year_id
    where sy.is_active
      and w.due_date < now()
    on conflict (student_id, week_id) do nothing;
  end if;

  update profiles set bible_plan = new_plan where id = auth.uid();
end;
$$;
