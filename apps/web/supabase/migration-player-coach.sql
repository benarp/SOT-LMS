-- Player Coach: a student who also leads a group.
--
-- They do homework and are counted everywhere a student is (reports,
-- reflections, the weekly email, billing, graduation), and they get a group
-- leader's read access to the rest of their group.
--
-- The group-leader policies compare as text rather than against the enum:
-- Postgres refuses to use an enum value added in the same transaction, and the
-- Supabase SQL editor runs the whole script as one.

alter type user_role add value if not exists 'player_coach';

drop policy if exists "profiles: group leader sees group" on profiles;
create policy "profiles: group leader sees group" on profiles for select using (
  current_user_role()::text in ('group_leader', 'player_coach') and group_id = current_user_group_id()
);

drop policy if exists "submissions: group leader read" on submissions;
create policy "submissions: group leader read" on submissions for select using (
  current_user_role()::text in ('group_leader', 'player_coach') and
  student_id in (select id from profiles where group_id = current_user_group_id())
);

drop policy if exists "student_week_plans: group leader read" on student_week_plans;
create policy "student_week_plans: group leader read" on student_week_plans
  for select using (
    current_user_role()::text in ('group_leader', 'player_coach') and
    student_id in (select id from profiles where group_id = current_user_group_id())
  );
