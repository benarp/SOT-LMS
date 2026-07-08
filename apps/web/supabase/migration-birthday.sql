-- Migration: birthday on user profiles
-- Shown in the admin students table with a birthday filter; students can
-- set their own via a narrow security-definer RPC (same pattern as
-- update_own_name — a blanket UPDATE policy would expose role/group_id).

alter table profiles add column if not exists birthday date;

create or replace function public.update_own_birthday(new_birthday date)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set birthday = new_birthday where id = auth.uid();
$$;
