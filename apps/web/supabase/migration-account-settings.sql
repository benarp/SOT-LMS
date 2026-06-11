-- Migration: student self-service account settings
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)

-- Lets any signed-in user update their own display name — and nothing else.
-- (A blanket RLS update policy on profiles would also expose role/group_id,
-- so this goes through a narrow security-definer function instead.)
create or replace function public.update_own_name(new_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set full_name = new_name where id = auth.uid();
$$;

-- Keep profiles.email in sync when a user confirms an email change.
-- (The existing handle_new_user trigger only fires on account creation.)
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure public.handle_user_email_update();
