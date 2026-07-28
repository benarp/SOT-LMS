-- Migration: legacy curriculum archive (2025 cohort)
-- Run in Supabase SQL editor (https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab → SQL Editor)
--
-- Archives the lesson/step structure used for the 2025 cohort, which ran on a
-- different platform than this app's weeks/homework_items model: lessons have
-- ordered steps of type content / multiple_choice / fill_in_upload, some with
-- an attached question bank ("Edit Questions" in the source UI). This is a
-- read-only historical snapshot transcribed from admin-panel screenshots —
-- not wired into any app code. It exists so the 2025 curriculum can later be
-- reconfigured into school_years/weeks/homework_items for the current class
-- year, once we're ready to do that mapping.
--
-- Captured so far: lessons 1–10 of 39 shown in the source UI ("ONLINE LESSONS
-- (39)"). More lessons and per-step detail (full titles, reading lists,
-- question bank contents) to be added later — see truncated titles below.

create table legacy_lessons (
  id uuid primary key default gen_random_uuid(),
  source_label text not null default '2025 cohort',
  lesson_number int not null,
  title text not null,
  due_date_label text,        -- e.g. "Due October 7th", as shown in the source UI
  start_date date,
  end_date date,
  status text not null default 'published',
  has_photo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_label, lesson_number)
);

create table legacy_lesson_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references legacy_lessons on delete cascade,
  step_number int not null,
  title text not null,        -- may be truncated as captured from the source UI (ends in "...")
  step_type text not null check (step_type in ('content', 'multiple_choice', 'fill_in_upload')),
  has_question_bank boolean not null default false,  -- source UI showed an "Edit Questions" link
  status text not null default 'published',
  created_at timestamptz not null default now(),
  unique (lesson_id, step_number)
);

create index legacy_lesson_steps_lesson_idx on legacy_lesson_steps (lesson_id, step_number);

alter table legacy_lessons enable row level security;
alter table legacy_lesson_steps enable row level security;

create policy "legacy_lessons: admin all" on legacy_lessons for all using (current_user_role() = 'admin');
create policy "legacy_lesson_steps: admin all" on legacy_lesson_steps for all using (current_user_role() = 'admin');

-- ─────────────────────────────────────────
-- DATA — transcribed from 2025 admin-panel screenshots
-- ─────────────────────────────────────────

insert into legacy_lessons (lesson_number, title, due_date_label, start_date, end_date, has_photo) values
  (1,  'Bible Reading Plan PDF', null,                 '2025-08-26', '2026-05-12', true),
  (2,  'Lesson 2',               'Due September 2nd',  '2025-08-26', '2025-09-02', true),
  (3,  'Lesson 3',               'Due September 9th',  '2025-08-26', '2025-09-09', true),
  (4,  'Lesson 4',               'Due September 16th', '2025-08-26', '2025-09-16', true),
  (5,  'Lesson 5',               'Due September 23rd', '2025-08-26', '2025-09-23', true),
  (6,  'Lesson 6',               'Due September 30th', '2025-09-03', '2025-09-30', true),
  (7,  'Lesson 7',               'Due October 7th',    '2025-09-30', '2025-10-12', true),
  (8,  'Lesson 8',               'Due October 14th',   '2025-10-07', '2025-10-15', true),
  (9,  'Lesson 9',               'Due October 21st',   '2025-10-07', '2025-10-22', true),
  (10, 'Lesson 10',              'Due October 28th',   '2025-10-22', '2025-10-29', true);

-- Lesson 1 — standing resource, single step
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 1), 1, '[August - December] Bible ...', 'content', false);

-- Lesson 2
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 2), 1, 'Bible Reading Plan [Sept. 2...',  'content', false),
  ((select id from legacy_lessons where lesson_number = 2), 2, 'Bible Reading Check-In [Se...',   'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 2), 3, 'Bible Project Video: Genesi...',  'fill_in_upload', true);

-- Lesson 3
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 3), 1, 'Bible Reading [Sept. 9th]',        'content', false),
  ((select id from legacy_lessons where lesson_number = 3), 2, 'Bible Reading Check-In [Se...',     'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 3), 3, 'Bible Project Video: Job',          'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 3), 4, 'Book "The Partying God"',           'multiple_choice', true);

-- Lesson 4
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 4), 1, 'Bible Reading [Sept. 16th]',        'content', false),
  ((select id from legacy_lessons where lesson_number = 4), 2, 'Bible Reading Check-In [Se...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 4), 3, 'Book "The Partying God"',            'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 4), 4, 'Bible Project Video: Genesi...',     'fill_in_upload', true);

-- Lesson 5
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 5), 1, 'Bible Reading [Due Sept. 2...',     'content', false),
  ((select id from legacy_lessons where lesson_number = 5), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 5), 3, 'Book "The Partying God"',            'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 5), 4, 'Bible Project Video: John 1-...',    'fill_in_upload', true);

-- Lesson 6
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 6), 1, 'Bible Reading [Due Septe...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 6), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 6), 3, 'Bible Memorization: Roman...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 6), 4, 'Bible Project Video: Exodu...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 6), 5, 'Bible Project Video: John 1...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 6), 6, 'Book "The Partying God"',            'multiple_choice', true);

-- Lesson 7 — note: source UI has no visible Step 3 (jumps 1, 2, 4, 5); preserved as shown
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 7), 1, 'Bible Reading [Due Octobe...',      'content', false),
  ((select id from legacy_lessons where lesson_number = 7), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 7), 4, 'Bible Project Video: Exodu...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 7), 5, 'Book "The Partying God"',            'multiple_choice', true);

-- Lesson 8
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 8), 1, 'Bible Reading [Due Octobe...',      'content', false),
  ((select id from legacy_lessons where lesson_number = 8), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 8), 3, 'Bible Memorization: Roman...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 8), 4, 'Bible Project Video: Leviticus',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 8), 5, 'Bible Project Video: Numb...',       'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 8), 6, 'Book: "The Partying God"',           'content', false),
  ((select id from legacy_lessons where lesson_number = 8), 7, 'Class Recording- Hearing ...',       'content', false);

-- Lesson 9
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 9), 1, 'Bible Reading [Due Oct. 21st]',     'content', false),
  ((select id from legacy_lessons where lesson_number = 9), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 9), 3, 'Bible Memorization: Roman...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 9), 4, 'Bible Project Video: Deuter...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 9), 5, 'Book Reflection: "The Party...',     'fill_in_upload', true);

-- Lesson 10
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 10), 1, 'Bible Reading [Due Octobe...',     'content', false),
  ((select id from legacy_lessons where lesson_number = 10), 2, 'Bible Reading Check-In [Du...',     'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 10), 3, 'Bible Memorization: Roman...',      'content', false),
  ((select id from legacy_lessons where lesson_number = 10), 4, 'Bible Project Video: Joshua',       'fill_in_upload', true);
