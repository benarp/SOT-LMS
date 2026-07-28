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
-- Captured so far: lessons 1–17, 19, 21, 22, 33–41. Lessons 18, 20, and 23–32
-- are still missing, as is per-step detail (full titles, reading lists,
-- question bank contents) — see truncated titles below. Note: the source UI's
-- earlier "ONLINE LESSONS (39)" count is now known to be stale/undercounting —
-- lesson 41 exists, so there are at least 41 lessons total.
--
-- Lesson 41 ("Complete Post-SOT") is a real draft, not yet published in the
-- source platform — its lesson-level status is 'incomplete' and its steps are
-- 'draft', preserved as such rather than the 'published' default used
-- elsewhere.

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
  (10, 'Lesson 10',              'Due October 28th',   '2025-10-22', '2025-10-29', true),
  (11, 'Lesson 11',              'Due November 4th',   '2025-10-29', '2025-11-05', true),
  (12, 'Lesson 12',              'Due November 11th',  '2025-11-05', '2025-11-16', true),
  (13, 'Lesson 13',              'Due November 18th',  '2025-11-12', '2025-11-19', true),
  (14, 'Lesson 14',              'Due November 25th',  '2025-11-12', '2025-11-30', true),
  (15, 'Lesson 15',              'Due December 2nd',   '2025-11-26', '2025-12-03', true),
  (16, 'Lesson 16',              'Due December 9th',   '2025-12-03', '2025-12-10', true),
  (17, 'Lesson 17',              'Due December 16th',  '2025-12-12', '2025-12-17', true),
  (19, 'Lesson 19',              'Due December 23rd',  '2025-12-15', '2025-12-28', true),
  (21, 'Lesson 21',              'Due December 30th',  '2025-12-24', '2026-01-04', true),
  (22, 'Lesson 22',              'Due January 6th',     '2025-12-31', '2026-01-11', true);

insert into legacy_lessons (lesson_number, title, due_date_label, start_date, end_date, has_photo, status) values
  (33, 'Lesson 33',        'Due March 24th', '2026-03-18', '2026-03-29', true, 'published'),
  (34, 'Lesson 34',        'Due March 31st', '2026-03-25', '2026-04-05', true, 'published'),
  (35, 'Lesson 35',        'Due April 7th',  '2026-03-31', '2026-04-12', true, 'published'),
  (36, 'Lesson 36',        'Due April 14th', '2026-03-31', '2026-04-19', true, 'published'),
  (37, 'Lesson 37',        'Due April 21st', '2026-03-31', '2026-04-26', true, 'published'),
  (38, 'Lesson 38',        'Due April 28th', '2026-03-31', '2026-05-03', true, 'published'),
  (39, 'Lesson 39',        'Due May 5th',    '2026-03-31', '2026-05-10', true, 'published'),
  (40, 'Lesson 40',        'Due May 12th',   '2026-03-31', '2026-05-12', true, 'published'),
  (41, 'Complete Post-SOT', null,            '2026-05-06', '2026-05-12', true, 'incomplete');

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

-- Lesson 11
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 11), 1, 'Bible Reading [Due Novem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 11), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 11), 3, 'Bible Memorization: Roman...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 11), 4, 'Book Reading "The Bonda...',         'content', false),
  ((select id from legacy_lessons where lesson_number = 11), 5, 'Bible Project Video: Judges',        'fill_in_upload', true);

-- Lesson 12
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 12), 1, 'Bible Reading [Due Novem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 12), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 12), 3, 'Book "The Bondage Break...',         'content', false),
  ((select id from legacy_lessons where lesson_number = 12), 4, 'Bible Project Video: Ruth',          'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 12), 5, 'Bible Project Video: Coloss...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 12), 6, 'Class Recording- Emotional...',      'content', false);

-- Lesson 13
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 13), 1, 'Bible Reading [Due Novem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 13), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 13), 3, 'Book "The Bondage Break...',         'content', false),
  ((select id from legacy_lessons where lesson_number = 13), 4, 'Bible Project Video: 1 Samu...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 13), 5, 'Bible Project Video: Philipp...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 13), 6, 'Bible Memorization: Roman...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 13), 7, 'Class Recording- Spiritual ...',     'content', false);

-- Lesson 14
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 14), 1, 'Bible Reading [Due Novem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 14), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 14), 3, 'Book "The Bondage Break...',         'content', false),
  ((select id from legacy_lessons where lesson_number = 14), 4, 'Bible Project Video: James',         'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 14), 5, 'Bible Project Video: Philem...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 14), 6, 'No Class Recording: Thank...',       'content', false);

-- Lesson 15
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 15), 1, 'Bible Reading [Due Dec. 2...',      'content', false),
  ((select id from legacy_lessons where lesson_number = 15), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 15), 3, 'Book "The Bondage Break...',         'content', false),
  ((select id from legacy_lessons where lesson_number = 15), 4, 'Bible Project Video: 2 Sam...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 15), 5, 'Bible Project Video: 1 Timot...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 15), 6, 'Class Recording- Ben & Am...',       'content', false);

-- Lesson 16
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 16), 1, 'Bible Reading [Due Decem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 16), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 16), 3, 'Bible Project Video: 1 & 2 C...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 16), 4, 'Bible Project Video: 2 Timo...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 16), 5, 'Bible Project Video: Titus',         'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 16), 6, 'Book: The Bondage Breaker',          'content', false);

-- Lesson 17
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 17), 1, 'Bible Reading Plan [Due D...',      'content', false),
  ((select id from legacy_lessons where lesson_number = 17), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 17), 3, 'Bible Project Video: Psalms',        'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 17), 4, 'Bible Project Video: Hebre...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 17), 5, 'Book Reflection: "The Bond...',      'fill_in_upload', true);

-- Lesson 19 — note: source UI has no visible Step 4 (jumps 1, 2, 3, 5); preserved as shown
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 19), 1, 'Bible Reading [Due Decem...',       'content', false),
  ((select id from legacy_lessons where lesson_number = 19), 2, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 19), 3, 'Bible Project Video: 1 & 2 K...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 19), 5, 'No Class Recording: Christ...',      'content', false);

-- Lesson 21
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 21), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 21), 2, 'No Class Recording: Christ...',      'content', false);

-- Lesson 22
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 22), 1, 'Catch Up Week!',                     'content', false),
  ((select id from legacy_lessons where lesson_number = 22), 2, 'Intentional Living- Joe Rho...',     'content', false);

-- Lesson 33
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 33), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 33), 2, 'Bible Project Video: Zechar...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 33), 3, 'Bible Project Video: Ezra a...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 33), 4, 'Bible Project Video: Malachi',       'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 33), 5, 'Bible Memorization: Luke 4...',      'content', false);

-- Lesson 34
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 34), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 34), 2, 'Book Reading "The Beginn...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 34), 3, 'Bible Project Video: Esther',        'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 34), 4, 'Bible Project Video: Joel',          'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 34), 5, 'Bible Project Video: Matthe...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 34), 6, 'Bible Memorization: Luke 4...',      'content', false);

-- Lesson 35
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 35), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 35), 2, 'Book Reading: "The Begin...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 35), 3, 'Bible Project Video: Mark',          'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 35), 4, 'Bible Project Video: Matthe...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 35), 5, 'Bible Memorization: Acts 2:...',     'content', false);

-- Lesson 36
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 36), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 36), 2, 'Book Reading: "The Begin...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 36), 3, 'Bible Memorization: Acts 2:...',     'content', false);

-- Lesson 37
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 37), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 37), 2, 'Book Reading: "The Begin...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 37), 3, 'Bible Project Video: Acts 1-12',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 37), 4, 'Bible Project Video: Galatia...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 37), 5, 'Bible Memorization: Acts 2:...',     'content', false);

-- Lesson 38
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 38), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 38), 2, 'Book Reading: "The Begin...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 38), 3, 'Bible Project Video: 1 Thes...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 38), 4, 'Bible Project Video: 2 Thes...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 38), 5, 'Bible Memorization: Acts 2:...',     'content', false);

-- Lesson 39
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 39), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 39), 2, 'Book Reading: "The Begin...',        'content', false),
  ((select id from legacy_lessons where lesson_number = 39), 3, 'Bible Project Video: Roman...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 39), 4, 'Bible Project Video: Roman...',      'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 39), 5, 'Bible Memorization: Acts 2:...',     'content', false);

-- Lesson 40
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank) values
  ((select id from legacy_lessons where lesson_number = 40), 1, 'Bible Reading Check-In [Du...',      'multiple_choice', true),
  ((select id from legacy_lessons where lesson_number = 40), 2, 'Bible Project Video: 1 Corin...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 40), 3, 'Bible Project Video: Acts 13...',    'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 40), 4, 'Bible Project Video: 2 Cori...',     'fill_in_upload', true),
  ((select id from legacy_lessons where lesson_number = 40), 5, 'Book Reflection: "The Begi...',      'fill_in_upload', true);

-- Lesson 41 — draft, not yet published in the source platform
insert into legacy_lesson_steps (lesson_id, step_number, title, step_type, has_question_bank, status) values
  ((select id from legacy_lessons where lesson_number = 41), 1, 'Bible Reading Check-In',             'multiple_choice', true, 'draft'),
  ((select id from legacy_lessons where lesson_number = 41), 2, 'Bible Project Video: Ephesi...',     'fill_in_upload', true, 'draft'),
  ((select id from legacy_lessons where lesson_number = 41), 3, 'Bible Project Video: Revela...',     'fill_in_upload', true, 'draft'),
  ((select id from legacy_lessons where lesson_number = 41), 4, 'Bible Project Video: Revela...',     'fill_in_upload', true, 'draft');
