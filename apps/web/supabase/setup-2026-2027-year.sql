-- One-off setup script for the 2026-2027 school year (Align -> SOT-LMS migration).
-- Run manually in the Supabase SQL editor. Not a tracked migration — matches the
-- existing one-off-script convention (export-auth-users.sql, fix-trigger*.sql).
--
-- Creates the school year INACTIVE. Activate later via /admin/settings
-- (setActiveSchoolYear), since activation auto-promotes paid/approved applicants.
--
-- Calendar: weekly Tuesday classes 9/1/2026-5/11/2027, skipping Thanksgiving
-- (11/24), Winter Break (12/16-1/8), and Easter/Spring Break (3/23) — 32 weeks
-- total. Due time assumes 6:00 PM America/Chicago — ADJUST THE TIME ZONE BELOW
-- if the school isn't in Central time; each week's due_date can also be edited
-- individually later via the admin curriculum UI.
--
-- Homework is only scaffolded (placeholder items) for weeks 1-6, per plan.
-- Weeks 7-32 are date-only rows for the admin to fill in via the existing UI.

begin;

insert into school_years (name, start_date, end_date, is_active)
values ('2026-2027', '2026-09-01', '2027-05-11', false);

insert into weeks (school_year_id, week_number, title, due_date)
select
  (select id from school_years where name = '2026-2027' and start_date = '2026-09-01'),
  week_number,
  case
    when week_number = 31 then 'Week 31 — Final'
    when week_number = 32 then 'Week 32 — Graduation'
    else 'Week ' || week_number
  end,
  (class_date + time '18:00') at time zone 'America/Chicago'
from (
  values
    (1,  date '2026-09-01'), (2,  date '2026-09-08'), (3,  date '2026-09-15'),
    (4,  date '2026-09-22'), (5,  date '2026-09-29'), (6,  date '2026-10-06'),
    (7,  date '2026-10-13'), (8,  date '2026-10-20'), (9,  date '2026-10-27'),
    (10, date '2026-11-03'), (11, date '2026-11-10'), (12, date '2026-11-17'),
    (13, date '2026-12-01'), (14, date '2026-12-08'), (15, date '2026-12-15'),
    (16, date '2027-01-12'), (17, date '2027-01-19'), (18, date '2027-01-26'),
    (19, date '2027-02-02'), (20, date '2027-02-09'), (21, date '2027-02-16'),
    (22, date '2027-02-23'), (23, date '2027-03-02'), (24, date '2027-03-09'),
    (25, date '2027-03-16'), (26, date '2027-03-30'), (27, date '2027-04-06'),
    (28, date '2027-04-13'), (29, date '2027-04-20'), (30, date '2027-04-27'),
    (31, date '2027-05-04'), (32, date '2027-05-11')
) as t(week_number, class_date);

-- Placeholder homework for weeks 1-6 only: one scripture reading, one video,
-- one reflection per week. Clearly marked so nothing looks like real content.
insert into homework_items (week_id, type, title, description, content, sort_order)
select
  w.id,
  item.type,
  item.title,
  '[Placeholder — fill in via admin curriculum panel]',
  item.content,
  item.sort_order
from weeks w
join school_years sy on sy.id = w.school_year_id
cross join (
  values
    ('bible_reading', 'TBD Scripture Reading', 'Day 1: TBD' || chr(10) || 'Day 2: TBD' || chr(10) || 'Day 3: TBD', 0),
    ('video',         'TBD Video',              null,                                                            1),
    ('reflection',    'TBD Reflection Prompt',  'TBD — reflection question goes here',                          2)
) as item(type, title, content, sort_order)
where sy.name = '2026-2027' and sy.start_date = '2026-09-01'
  and w.week_number between 1 and 6;

commit;
