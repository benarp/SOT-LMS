-- Migration: homework item types rework + reflection responses
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)
--
-- Types become: bible_reading ("Scripture Reading"), book_reading ("Book Reading"),
-- video ("Video"), reflection ("Reflection", with a typed response),
-- book_reflection (book-linked reflection, displays as "Reflection").
-- Existing 'written' items are migrated to 'reflection'.

-- The enum is converted to text + check constraint so future type additions
-- don't need the ALTER TYPE ... ADD VALUE transaction dance.
alter table homework_items alter column type type text using type::text;
drop type if exists homework_type;

update homework_items set type = 'reflection' where type = 'written';

alter table homework_items add constraint homework_items_type_check
  check (type in ('bible_reading', 'book_reading', 'video', 'book_reflection', 'reflection'));

-- Reflection items store the student's typed response on their completion record
alter table submissions add column if not exists response_text text;
