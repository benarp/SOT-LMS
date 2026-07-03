-- Migration: remove the standalone Book Reflections feature
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)
--
-- Book reflections are now just regular "reflection" homework items in the
-- curriculum. This drops the dedicated books/book_reflections tables and all
-- historical reflection answers, per explicit decision to delete rather than
-- migrate (books weren't tied to a week, so there's no automatic mapping).

-- Drop dependent policies first
drop policy if exists "books: read all" on books;
drop policy if exists "books: admin write" on books;
drop policy if exists "book_reflections: own" on book_reflections;
drop policy if exists "book_reflections: admin read" on book_reflections;
drop policy if exists "book_reflections: group leader read" on book_reflections;

-- book_id on homework_items only ever pointed at books; remove it first
-- so the tables below can be dropped without CASCADE
alter table homework_items drop column if exists book_id;

drop table if exists book_reflections;
drop table if exists books;

-- Retire the book_reflection homework type — anything still using it
-- becomes a plain reflection (loses its book link, keeps everything else)
update homework_items set type = 'reflection' where type = 'book_reflection';

alter table homework_items drop constraint if exists homework_items_type_check;
alter table homework_items add constraint homework_items_type_check
  check (type in ('bible_reading', 'book_reading', 'video', 'reflection'));

-- Note: this does not delete the Supabase Storage bucket used for uploaded
-- reflection files (bucket: "reflections"). Delete it manually from the
-- Supabase dashboard → Storage if you want to reclaim that space too.
