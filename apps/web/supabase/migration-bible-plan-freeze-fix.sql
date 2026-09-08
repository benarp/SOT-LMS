-- Fix: update_own_bible_plan froze the week the student is currently looking at.
--
-- The original condition froze every week with due_date < now(). But the
-- dashboard treats a week as "current" until 7 days AFTER its due date (the
-- grace window in dashboard/page.tsx). During that window a week is both
-- on-screen and "past", so switching plans froze the visible week to the old
-- plan and the toggle appeared to do nothing.
--
-- New rule — freeze a week only if it is genuinely out of reach:
--   * its due date is more than 7 days ago (past the dashboard's grace window), OR
--   * the student already submitted work for it, so completed work is never
--     orphaned by a switch.
--
-- Safe to re-run.

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

  if old_plan is not null and old_plan is distinct from new_plan then
    insert into student_week_plans (student_id, week_id, plan)
    select auth.uid(), w.id, old_plan
    from weeks w
    join school_years sy on sy.id = w.school_year_id
    where sy.is_active
      and (
        w.due_date < now() - interval '7 days'
        or exists (
          select 1
          from submissions s
          join homework_items hi on hi.id = s.homework_item_id
          where hi.week_id = w.id
            and s.student_id = auth.uid()
        )
      )
    on conflict (student_id, week_id) do nothing;
  end if;

  update profiles set bible_plan = new_plan where id = auth.uid();
end;
$$;
