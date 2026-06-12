-- Migration: school year completion + alumni role
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)

-- New role for graduated students. (Safe here: the new value isn't used
-- elsewhere in this script, which is all Postgres requires.)
alter type user_role add value if not exists 'alumni';

-- When a year was completed
alter table school_years add column if not exists completed_at timestamptz;

-- Which year an alumnus graduated from — shown on their profile
alter table profiles add column if not exists alumni_year_id uuid references school_years(id) on delete set null;
