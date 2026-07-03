-- Export all auth users for portability / migration off Supabase.
-- Run in Supabase SQL editor (requires service_role access to auth schema).
--
-- bcrypt password hashes are portable — any standard Postgres auth stack
-- (Auth.js, Lucia, etc.) can import them directly.

select
  id,
  email,
  encrypted_password,   -- bcrypt hash, portable
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data    -- stores display name etc if set
from auth.users
order by created_at;

-- To migrate RLS policies off Supabase, replace auth.uid() with:
--   current_setting('app.current_user_id', true)::uuid
-- and set that variable at session start in your auth middleware.
