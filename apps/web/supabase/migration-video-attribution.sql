-- Migration: BibleProject attribution flag on video homework items
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)

alter table homework_items
  add column if not exists show_attribution boolean not null default true;
