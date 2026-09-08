-- Adds phone and gender to profiles for the Align roster migration.
-- Admin-only: revoke column-level select from `authenticated` so neither the
-- owning student's own-row policy nor a group leader's group-scoped policy
-- exposes these columns — only service-role (admin) actions can read them.

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists gender text check (gender in ('Male', 'Female'));

revoke select (phone, gender) on profiles from authenticated;
